# 小O 助手（中文 + 省钱档）接入说明

当前博客部署在 GitHub Pages（静态站）。  
因此模型请求必须走外部网关（Cloudflare Worker），不能把 API Key 放前端。

## 已完成改动

1. `src/components/AIAssistant.astro`：小O浮窗助手，全部中文文案
2. `src/layouts/Layout.astro`：全局挂载小O组件
3. `workers/ai-gateway/worker.mjs`：网关代理 + 中文错误提示 + 省钱参数
4. `workers/ai-gateway/wrangler.toml.example`：省钱档默认配置
5. `.env.example`：前端变量示例
6. `.github/workflows/deploy.yml`：构建时注入 `PUBLIC_AI_*` 变量

## 1. 部署网关

```powershell
cd workers/ai-gateway
Copy-Item wrangler.toml.example wrangler.toml
npx wrangler login
npx wrangler secret put AI_API_KEY
npx wrangler deploy
```

部署后会得到：

```text
https://<worker-name>.<subdomain>.workers.dev
```

前端要填这个接口：

```text
https://<worker-name>.<subdomain>.workers.dev/chat
```

## 2. 配置前端环境变量

### 本地开发（`.env`）

```env
PUBLIC_AI_ASSISTANT_ENABLED=true
PUBLIC_AI_ASSISTANT_NAME=小O
PUBLIC_AI_GATEWAY_URL=https://<worker-name>.<subdomain>.workers.dev/chat
```

### GitHub 仓库（Actions Variables）

1. `PUBLIC_AI_ASSISTANT_ENABLED` = `true`
2. `PUBLIC_AI_ASSISTANT_NAME` = `小O`
3. `PUBLIC_AI_GATEWAY_URL` = 你的 Worker `/chat` 地址

然后重新运行 `Deploy to GitHub Pages`。

## 3. 最省钱默认档（已内置）

1. `RATE_LIMIT_PER_MIN = 10`
2. `MAX_HISTORY_MESSAGES = 4`
3. `MAX_MESSAGE_CHARS = 800`
4. `MAX_USER_INPUT_CHARS = 300`
5. `MAX_OUTPUT_TOKENS = 220`
6. `TEMPERATURE = 0.1`

含义：更短上下文、更短回复、更低频率，优先压成本。

## 4. 随时停用

1. 立即隐藏入口：`PUBLIC_AI_ASSISTANT_ENABLED=false` 后重新部署
2. 停用网关：`npx wrangler delete`
3. 彻底停费：在模型平台撤销 `AI_API_KEY`
