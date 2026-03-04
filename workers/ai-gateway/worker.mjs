const RATE_BUCKETS = new Map();

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function parseAllowedOrigins(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildCorsHeaders(requestOrigin, allowedOrigins) {
  const normalizedOrigin = requestOrigin || '';
  const allowAny = allowedOrigins.includes('*');
  const matched = allowAny || allowedOrigins.includes(normalizedOrigin);

  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (matched && normalizedOrigin) {
    headers['Access-Control-Allow-Origin'] = normalizedOrigin;
  }

  return { headers, matched };
}

function getClientIp(request) {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp;
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

function checkRateLimit(ip, limitPerMinute) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const key = ip || 'unknown';

  const record = RATE_BUCKETS.get(key);
  if (!record || now > record.resetAt) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= limitPerMinute) {
    return { allowed: false };
  }

  record.count += 1;
  return { allowed: true };
}

function coerceNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function normalizeMessages(rawMessages, maxHistory, maxCharsPerMessage) {
  if (!Array.isArray(rawMessages)) return [];

  return rawMessages
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const role = item.role === 'assistant' ? 'assistant' : 'user';
      const content =
        typeof item.content === 'string'
          ? item.content.trim().slice(0, maxCharsPerMessage)
          : '';
      return { role, content };
    })
    .filter((item) => item.content.length > 0)
    .slice(-maxHistory);
}

function buildSystemPrompt(assistantName) {
  return [
    `You are ${assistantName}, the assistant for OKay's technical blog.`,
    'Reply in concise Chinese by default.',
    'Be practical, accurate, and avoid unsupported claims.',
    'If you are uncertain, state uncertainty and provide validation steps.',
    'Prefer actionable steps over long disclaimers.',
  ].join('\n');
}

function buildPageHint(page) {
  if (!page || typeof page !== 'object') return '';

  const title = typeof page.title === 'string' ? page.title.trim().slice(0, 120) : '';
  const path = typeof page.path === 'string' ? page.path.trim().slice(0, 120) : '';
  const url = typeof page.url === 'string' ? page.url.trim().slice(0, 200) : '';

  const parts = [];
  if (title) parts.push(`Page title: ${title}`);
  if (path) parts.push(`Page path: ${path}`);
  if (url) parts.push(`Page URL: ${url}`);

  if (!parts.length) return '';
  return `Website context:\n${parts.join('\n')}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');
    const requestOrigin = request.headers.get('Origin') || '';
    const cors = buildCorsHeaders(requestOrigin, allowedOrigins);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors.headers });
    }

    if (!cors.matched && requestOrigin) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, cors.headers);
    }

    if (url.pathname !== '/chat') {
      return jsonResponse({ error: 'Not found' }, 404, cors.headers);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, cors.headers);
    }

    if (!env.AI_API_KEY) {
      return jsonResponse(
        { error: 'Missing AI_API_KEY secret in worker environment' },
        500,
        cors.headers,
      );
    }

    const rateLimitPerMinute = coerceNumber(env.RATE_LIMIT_PER_MIN, 20, 1, 300);
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(clientIp, rateLimitPerMinute);

    if (!rateCheck.allowed) {
      return jsonResponse(
        { error: 'Too many requests. Retry in about one minute.' },
        429,
        {
          ...cors.headers,
          'Retry-After': '60',
        },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, cors.headers);
    }

    const assistantNameRaw = typeof body?.assistant === 'string' ? body.assistant : '';
    const assistantName =
      assistantNameRaw.trim().slice(0, 24) || env.ASSISTANT_NAME || '\u5c0fO';

    const maxHistory = coerceNumber(env.MAX_HISTORY_MESSAGES, 8, 1, 20);
    const maxCharsPerMessage = coerceNumber(env.MAX_MESSAGE_CHARS, 1200, 80, 5000);
    const normalizedMessages = normalizeMessages(
      body?.messages,
      maxHistory,
      maxCharsPerMessage,
    );

    const lastUserMessage = [...normalizedMessages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      return jsonResponse(
        { error: 'At least one user message is required' },
        400,
        cors.headers,
      );
    }

    const maxUserInputChars = coerceNumber(env.MAX_USER_INPUT_CHARS, 600, 80, 5000);
    if (lastUserMessage.content.length > maxUserInputChars) {
      return jsonResponse(
        { error: `Input too long. Max ${maxUserInputChars} characters.` },
        400,
        cors.headers,
      );
    }

    const pageHint = buildPageHint(body?.page);
    const outboundMessages = [
      { role: 'system', content: buildSystemPrompt(assistantName) },
      ...(pageHint ? [{ role: 'system', content: pageHint }] : []),
      ...normalizedMessages,
    ];

    const aiBaseUrl = (env.AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    const model = env.AI_MODEL || 'deepseek-chat';
    const maxOutputTokens = coerceNumber(env.MAX_OUTPUT_TOKENS, 420, 64, 4096);
    const temperature = coerceNumber(env.TEMPERATURE, 0.2, 0, 1);

    const upstream = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature,
        max_tokens: maxOutputTokens,
        messages: outboundMessages,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return jsonResponse(
        {
          error: `Upstream model request failed (${upstream.status})`,
          details: errText.slice(0, 600),
        },
        502,
        cors.headers,
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...cors.headers,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  },
};
