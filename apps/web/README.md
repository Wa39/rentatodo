## Production deploy (Vercel)

Hosted on Vercel, Root Directory `apps/web`. The API (`apps/api`, on EC2) is
served over plain HTTP with no domain in front of it yet, while Vercel always
serves over HTTPS — so the browser calling the API directly gets blocked as
mixed content. `vercel.json` works around this with a same-origin rewrite:
the browser calls `/api/...` (HTTPS, same origin as the page), and Vercel
proxies that server-to-server to the EC2 IP over HTTP, where the
browser's mixed-content check doesn't apply. `VITE_API_URL` is set to `/api`
in the Vercel project's environment variables to match.

This is a deliberate, temporary exception to this repo's "no hardcoded
IPs in source code" rule (see root `CLAUDE.md`) — `vercel.json` rewrite
destinations can't reference an environment variable, so the EC2 IP has to
be a literal here. The real fix is putting the API behind a domain with a
real TLS certificate (e.g. an ALB with ACM, or Nginx + Let's Encrypt) and
pointing `VITE_API_URL` straight at `https://` that domain — at which point
this file's rewrite (and this note) can go away.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
