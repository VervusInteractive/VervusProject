# Vervus Admin Client

Minimal Vite/React admin dashboard scaffold for Render static hosting.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Configure `VITE_ADMIN_API_URL` to point at the admin server. The starter screen calls
`GET /api/admin/overview` and sends the entered token as `X-Admin-Token`.
