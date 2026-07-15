# Web App Scaffold — Design

## Context

`apps/web` (the owner dashboard) has no scaffold yet — only a `.gitkeep`, on every branch. `apps/api` already has a FastAPI scaffold on `main`. Per `CLAUDE.md`, the stack was "TBD — updated on day 3 once app scaffolds exist"; this document makes that decision for the web app.

**Update (2026-07-15):** the contract, `packages/contracts/openapi.yaml`, has since merged into `develop` (PR #2, plus team-review feedback: structured `{code, message}` error shape, required `expires_in` on login, `DUPLICATE_RESERVATION` handling on reservation creation). It is no longer a stub — the full v1.0.0 spec (auth, items, reservations, checkin/checkout, reports, transactions, earnings) is now available on `develop`. Phase 2 below is therefore unblocked; it was written while the spec was still pending and is left in place as the plan for a follow-up piece of work, not because the spec is still missing.

Scope constraint: this work only touches `apps/web` and (for shared design tokens) a new `packages/design-tokens`. It does not touch `apps/api`, `apps/mobile`, `.github/`, `e2e/`, or `infra/`.

## Stack & tooling

- **React 18 + TypeScript**, scaffolded via Vite (`react-ts` template). Chosen over Next.js because the dashboard is entirely behind login — no SSR/SEO requirement — so a plain SPA is simpler to build, run, and deploy.
- **React Router** for client-side routing.
- **Tailwind CSS + shadcn/ui**. Tailwind is a hard requirement (not just a preference) because `apps/mobile` uses React Native + NativeWind, and the team wants a consistent visual language across web and mobile via shared design tokens.
- **pnpm** as the package manager.
- **TanStack Query** for server-state/data-fetching, added in Phase 2 once there's a real API to call.
- Deployment target is undecided (`infra/` is empty) — the Vite build output is a static bundle deployable to any static host, so this is not blocking.

## Shared design tokens

A new package, `packages/design-tokens`, holds shared token values (colors, spacing, font scale) so `apps/web`'s Tailwind config and `apps/mobile`'s NativeWind config can stay visually consistent.

This work creates the package and wires only `apps/web`'s `tailwind.config.ts` to import from it. It does **not** touch `apps/mobile` — wiring NativeWind to consume the same tokens is left for whoever owns the mobile app (Zero) to do separately. A short README in the package explains how to consume it from NativeWind.

## Phasing

This scaffold is still split into two phases, but the reason has changed: the OpenAPI spec is now finalized on `develop`, so Phase 2 is no longer *blocked* — it's simply sequenced after Phase 1 so the shell (routing, layout, styling) lands first and real API wiring follows as a focused second pass. **Only Phase 1 is in scope for the resulting implementation plan/PR; Phase 2 is planned separately once Phase 1 ships.**

**Phase 1 (this work):**
- App shell: Vite + React + TypeScript project, React Router routes, dashboard layout with nav
- Tailwind CSS configured, pulling tokens from `packages/design-tokens`
- shadcn/ui installed with a baseline set of components (button, table, dialog, form, input)
- Pages exist as UI shells using placeholder/mock data — no real network calls:
  - `/login`, `/register`
  - `/dashboard` (home)
  - `/items` (my listings — list/create/edit UI)
  - `/requests` (incoming reservation requests — approve/reject/cancel UI)
  - `/earnings`
- Route-protection *pattern* stubbed (e.g. a `RequireAuth` wrapper reading from a placeholder auth context) — not wired to a real login call yet
- Vitest + React Testing Library configured with at least one smoke test per page shell

**Phase 2 (future work, now unblocked — spec is final on `develop`):**
- `openapi-typescript` codegen script generating types/client from `packages/contracts/openapi.yaml`
- Real TanStack Query hooks replacing placeholder data on each page
- Real login/register flow and token storage wired to `POST /auth/login` / `/auth/register`

## Folder structure

```
apps/web/
  src/
    routes/          # login, register, dashboard, items, requests, earnings
    components/      # shared UI (shadcn/ui components live here)
    layouts/         # dashboard layout w/ nav
    lib/             # utils, mock data used by Phase 1 page shells
    hooks/           # added in Phase 2 — TanStack Query hooks
    api/             # added in Phase 2 — generated client + types
  tailwind.config.ts # imports from packages/design-tokens
  vite.config.ts
  package.json

packages/design-tokens/
  tokens.ts          # colors, spacing, font scale
  package.json
  README.md          # notes for wiring into NativeWind (apps/mobile), not done here
```

## Testing

- Vitest + React Testing Library for component/unit tests, the standard pairing with Vite.
- E2E tests remain owned by Wa in `e2e/` — this work does not add anything there.

## Explicitly out of scope for this work

- Wiring `apps/web`'s lint/test/build into `.github/workflows/ci.yml` — left for Wa (`.github/` is their CODEOWNERS territory) to add.
- Any change to `apps/mobile` (including NativeWind token wiring).
- Any change to `apps/api`.
- Real API integration (Phase 2 — spec is available, but this work is Phase 1 only; Phase 2 is planned separately).
- Deployment/hosting configuration.
