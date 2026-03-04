# Low-Cost Setup for Assistant (default name encoded as \u5c0fO)

This project is deployed as a static site on GitHub Pages.  
Because of that, model calls must go through an external gateway (Cloudflare Worker).

## What has been implemented

1. `src/components/AIAssistant.astro`: floating chat widget
2. `src/layouts/Layout.astro`: global mount for the widget
3. `workers/ai-gateway/worker.mjs`: OpenAI-compatible proxy with basic cost controls
4. `workers/ai-gateway/wrangler.toml.example`: deployment template
5. `.env.example`: frontend config example
6. `.github/workflows/deploy.yml`: build now accepts public AI env vars

## 1. Deploy the gateway (Cloudflare Worker)

```powershell
cd workers/ai-gateway
Copy-Item wrangler.toml.example wrangler.toml
npx wrangler login
npx wrangler secret put AI_API_KEY
npx wrangler deploy
```

After deploy, you get a base URL like:

```text
https://okay-blog-ai-gateway.<your-subdomain>.workers.dev
```

Use this endpoint in the blog:

```text
https://okay-blog-ai-gateway.<your-subdomain>.workers.dev/chat
```

## 2. Configure frontend environment variables

### Local development

Create `.env` in repo root:

```env
PUBLIC_AI_ASSISTANT_ENABLED=true
PUBLIC_AI_GATEWAY_URL=https://okay-blog-ai-gateway.<your-subdomain>.workers.dev/chat
# Optional:
# PUBLIC_AI_ASSISTANT_NAME=YourAssistantName
```

### GitHub Pages build

In GitHub repo settings, add Actions Variables:

1. `PUBLIC_AI_ASSISTANT_ENABLED` = `true`
2. `PUBLIC_AI_GATEWAY_URL` = your Worker `/chat` URL
3. `PUBLIC_AI_ASSISTANT_NAME` = custom display name (optional)

Then rerun `Deploy to GitHub Pages`.

## 3. Built-in cost controls

Worker template already includes:

1. per-IP requests per minute (`RATE_LIMIT_PER_MIN`)
2. max history messages (`MAX_HISTORY_MESSAGES`)
3. max user input chars (`MAX_USER_INPUT_CHARS`)
4. max output tokens (`MAX_OUTPUT_TOKENS`)

Recommended conservative defaults:

1. `RATE_LIMIT_PER_MIN = 20`
2. `MAX_HISTORY_MESSAGES = 8`
3. `MAX_USER_INPUT_CHARS = 600`
4. `MAX_OUTPUT_TOKENS = 420`

## 4. How to stop later

1. Hide UI immediately: set `PUBLIC_AI_ASSISTANT_ENABLED=false` and redeploy
2. Stop gateway: `npx wrangler delete`
3. Stop model billing immediately: revoke `AI_API_KEY` at model provider
