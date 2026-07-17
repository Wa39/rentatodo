# RentaTodo — Mobile (renter app)

Expo SDK 57 + expo-router + TypeScript. This app covers **only the renter
experience**: browse, search, request reservations, check-in/out and report
problems. Publishing/managing items belongs to the owner web (`apps/web`).

## Run it

```bash
npm install
npm run web       # quickest way to try it (browser)
npx expo start    # native: scan the QR with Expo Go
```

## Demo mode vs real API

The data layer switches on one env var:

| `EXPO_PUBLIC_API_URL` | Behavior |
|---|---|
| unset (default) | **Demo mode** — local mock data shaped exactly like the contract; any email/password signs in |
| set (e.g. `http://localhost:8000`) | Real API — auth, items and reservations hit the backend |

Copy `.env.example` to `.env` and fill the URL when the API is running
(docker compose in `apps/api`). No code changes needed.

## Architecture (short version)

- `src/app/` — expo-router routes: `(tabs)` group (Home, My rentals,
  Profile + hidden detail routes) behind an auth guard, plus `/login` and
  `/register`.
- `src/data/data-source.ts` — the `DataSource` interface. Two
  implementations: `ApiDataSource` (real, `src/data/api/`) and
  `MockDataSource` (demo). Screens only know the interface.
- `src/data/types.ts` — mirrors the frozen contract
  (`packages/contracts/openapi.yaml`): snake_case fields, money in USD
  cents (`formatUSD` divides by 100), English enums, stable error codes.
- `src/data/labels.ts` — the single place where contract enums/errors map
  to Spanish UI text.
- `src/context/session-context.tsx` — token restore, login/register/logout.
  Token lives in expo-secure-store (keychain); localStorage on web.
- `src/hooks/use-polling.ts` — 15s refresh while a screen is focused
  (project decision: polling instead of push).

## Scope rules (do not break)

- No publish/manage item flows — mobile rents only.
- No geolocation, no push notifications, one photo per check-in/out.
- Payments are simulated: deposit hold/release/freeze, no real charges.
- The API contract is frozen; never invent fields — change
  `packages/contracts/openapi.yaml` first (PR approved by all consumers).

## Verify before pushing

```bash
npx tsc --noEmit                  # typecheck
npx expo export --platform web    # all routes must bundle
```
