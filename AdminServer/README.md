# Vervus Admin Server

Minimal Express admin API scaffold for Render.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

The server exposes:

- `GET /healthz` for Render health checks.
- `GET /api/admin/overview` for a protected starter admin endpoint.

Set `ADMIN_TOKEN` and send it as `X-Admin-Token` when calling protected admin routes.
