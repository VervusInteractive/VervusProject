# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Environment variables

Set `VITE_SERVER_URL` to the URL of your socket server (for example, your Render backend URL).

Example:

```bash
VITE_SERVER_URL=https://your-server.onrender.com
```

To manage the starting Host/Play page in Storyblok, add a public Delivery API token:

```bash
VITE_STORYBLOK_DELIVERY_API_TOKEN=your_public_delivery_token
VITE_STORYBLOK_REGION=eu
VITE_STORYBLOK_START_PAGE_SLUG=home
```

The start page story can use either a `start_page` content type directly, or a `page` story with a `start_page` block in its `body`. Supported fields are:

- `kicker`
- `headline`
- `description`
- `host_button_label`
- `play_button_label`

Vite only exposes environment variables to client-side code when they begin with the `VITE_` prefix.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
