# Connect Login (+ Register) to the Real API — Design

## What this is

Replaces `apps/web`'s mock `AuthContext` (a boolean toggle with no network
calls) with a real integration against `apps/api`'s three live Auth
endpoints (`POST /auth/register`, `POST /auth/login`, `GET /users/me`).
This is the first PR on `feature/web-connect-login`, cut from `develop`,
and is intentionally scoped to auth only — no other page starts talking to
the real API in this PR.

## Current state (before this change)

- `apps/web/src/lib/AuthContext.tsx`: `login()` takes no arguments and just
  sets `isAuthenticated = true`. `logout()` sets it back to `false`. Nothing
  persists across a page reload.
- `apps/web/src/routes/LoginPage.tsx`: `handleSubmit` calls `login()` (no
  args) and navigates to `/dashboard`. The email/password fields are
  collected but never sent anywhere.
- `apps/web/src/routes/RegisterPage.tsx`: `handleSubmit` just navigates to
  `/login`. Nothing is sent anywhere.
- `apps/web/src/components/RequireAuth.tsx`: redirects to `/login` when
  `useAuth().isAuthenticated` is false. This component's own logic does not
  need to change.
- No `fetch`/`axios` call exists anywhere in `apps/web`. No `VITE_API_URL`
  or any env var is read anywhere in `apps/web`.

## What's live on the API (confirmed against `packages/contracts/openapi.yaml`
and `apps/api/app/routers/auth.py`, `apps/api/app/schemas/auth.py`)

- `POST /auth/register` — body `{name, email, password}` (password
  `minLength: 8`), returns `201` with `UserResponse`
  (`{id, name, email, created_at}`), or `422` with `{error: {code, message}}`
  on invalid data or duplicate email.
- `POST /auth/login` — body `{email, password}`, returns `200` with
  `LoginResponse` (`{access_token, token_type: "bearer", expires_in}`), or
  `401` with `{error: {code, message}}` on invalid credentials.
- `GET /users/me` — requires `Authorization: Bearer <token>`, returns `200`
  with `UserResponse`, or `401` with `{error: {code, message}}`.

## Architecture

One new module, one rewritten context, two updated pages, one updated
component's tests (not its logic):

```
apps/web/src/lib/api.ts              (new)  — fetch wrapper, ApiError, login()/register()/getMe()
apps/web/src/lib/AuthContext.tsx     (rewrite) — real login/register/logout, localStorage, user state
apps/web/src/routes/LoginPage.tsx    (modify) — async submit, error banner, loading state
apps/web/src/routes/RegisterPage.tsx (modify) — async submit, error banner, loading state
apps/web/.env.example                (new)   — VITE_API_URL placeholder
```

`apps/web/src/components/RequireAuth.tsx` is untouched (its logic already
just reads `isAuthenticated`); only its test file needs updating because
`AuthProvider`'s internals change.

### `apps/web/src/lib/api.ts`

```ts
export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface LoginResult {
  access_token: string
  token_type: string
  expires_in: number
}

interface UserProfile {
  id: string
  name: string
  email: string
  created_at: string
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json()
  if (!response.ok) {
    throw new ApiError(body.error.code, body.error.message)
  }
  return body as T
}

export function apiLogin(email: string, password: string): Promise<LoginResult> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function apiRegister(name: string, email: string, password: string): Promise<UserProfile> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })
}

export function apiGetMe(token: string): Promise<UserProfile> {
  return request('/users/me', { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
}
```

This is the *only* file that knows the base URL, the request/response
shapes, or the `{error: {code, message}}` envelope. Every other file in
`apps/web` that needs auth goes through `AuthContext`, never through
`api.ts` directly.

### `apps/web/src/lib/AuthContext.tsx`

```ts
interface AuthUser {
  id: string
  name: string
  email: string
}

interface AuthContextValue {
  isAuthenticated: boolean
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}
```

`AuthProvider` holds `token: string | null` and `user: AuthUser | null` in
state. `token`'s initial value comes from a **lazy `useState` initializer**
(`useState(() => localStorage.getItem('rentatodo_token'))`), not a
`useEffect` — this makes `isAuthenticated` correct on the very first
render, so `RequireAuth` never bounces an already-logged-in user to
`/login` for a single frame on reload. A separate `useEffect` (runs once,
on mount) checks: if `token` is non-null, call `apiGetMe(token)` to
populate `user` (no server round-trip happens before this — see
"Explicitly out of scope" below for why an invalid stored token isn't
caught any earlier). If that `getMe` call fails (expired/invalid token),
`logout()` is called to clear the stale token rather than leaving the app
in a half-authenticated state (token present, `user` forever `null`).

`login(email, password)`: calls `apiLogin`, stores the returned
`access_token` in both React state and `localStorage`
(`rentatodo_token`), then calls `apiGetMe(access_token)` to populate
`user`. Throws (propagates) `ApiError` on failure — does not catch it, so
the caller (`LoginPage`) handles the error message.

`register(name, email, password)`: calls `apiRegister`. On success, calls
this same context's `login(email, password)` internally (auto-login, per
the approved design) and returns once that resolves. Throws `ApiError` on
either call's failure.

`logout()`: clears `token`/`user` state and removes the `localStorage` key.

`isAuthenticated` is derived (`token !== null`), not a separate state
variable, so it can never drift out of sync with `token`.

### `LoginPage.tsx` / `RegisterPage.tsx`

Both get:
- `const [error, setError] = useState<string | null>(null)`
- `const [submitting, setSubmitting] = useState(false)`
- `handleSubmit` becomes `async`, wraps the `useAuth()` call in
  `try { setSubmitting(true); setError(null); await ...; navigate('/dashboard') } catch (err) { if (err instanceof ApiError) setError(err.message) } finally { setSubmitting(false) }`
- An error banner renders above the form when `error` is set:
  `<p className="rounded-md bg-destructive/10 p-two text-sm text-destructive">{error}</p>`
  (reusing existing `destructive` design tokens already used elsewhere in
  `apps/web`, e.g. the delete button in `ItemCard.tsx`).
- The submit `<Button>` gets `disabled={submitting}` and its label swaps to
  `t.login.submitting` / `t.register.submitting` while `submitting` is
  true (new i18n keys, English: `"Signing in…"` / `"Creating account…"`).

## Config

`apps/web/.env.example` (new file):

```
# Copy this file to .env and fill in real local values.
# .env is gitignored — never commit it.

# Base URL of the API this app talks to (apps/api).
VITE_API_URL=http://localhost:8000
```

`import.meta.env.VITE_API_URL` is read only inside `api.ts`. No other file
reads it directly.

## Data flow

**Login:** user submits form → `LoginPage` calls
`auth.login(email, password)` → `AuthContext` calls `POST /auth/login` →
on success, stores token, calls `GET /users/me`, stores user → `LoginPage`
navigates to `/dashboard`. On `401`, `AuthContext` throws `ApiError('...',
'Invalid credentials')` (message text comes verbatim from the API's error
response), `LoginPage` catches it and renders the banner; the user stays on
the login page with their typed email/password intact (state isn't
cleared on error).

**Register:** user submits form → `RegisterPage` calls
`auth.register(name, email, password)` → `AuthContext` calls
`POST /auth/register`, then internally calls its own `login(email,
password)` → on success, `RegisterPage` navigates to `/dashboard` directly
(skips `/login` entirely, per the approved auto-login design). On `422`
(e.g. duplicate email), the error message from the API is shown in the
same banner pattern; the user stays on the register page.

**Page reload while logged in:** `AuthProvider` mounts, finds a token in
`localStorage`, optimistically sets `isAuthenticated = true` immediately
(so `RequireAuth` doesn't bounce to `/login` for a real user), then
resolves `user` asynchronously via `GET /users/me`. If that call fails, the
token is cleared and the user is logged out — the next `RequireAuth` check
that runs (e.g., on next navigation) redirects to `/login`.

## Error handling

Every error the user can see is either:
1. HTML5 form validation (unchanged — `required`, `type="email"`,
   `minLength={8}` on the password input, already present).
2. An `ApiError` with a `message` string taken directly from the API's
   `{error: {message}}` — no client-side re-wording, so the API's copy is
   the single source of truth for "what went wrong."
3. A network failure (`fetch` itself rejects — API unreachable). `api.ts`
   does not special-case this; it propagates as a generic `TypeError` from
   `fetch`, which is not an `instanceof ApiError`. `LoginPage`/`RegisterPage`
   catch this too and show a fixed fallback string (new i18n key,
   `t.errors.network`: `"Couldn't reach the server. Check your connection
   and try again."`) so the user never sees a raw JS error or a blank
   screen.

## Testing

No new dependency — `vi.spyOn(global, 'fetch')` per test, matching the
project's existing preference against adding libraries without
justification (MSW would be the "proper" tool but is unjustified for 3
endpoints).

- `AuthContext.test.tsx`: rewritten to mock `fetch`, assert `login()`
  stores a token in `localStorage` and populates `user`, `register()`
  calls both endpoints and ends authenticated, `logout()` clears
  `localStorage`, and mount-with-existing-token calls `GET /users/me` and
  populates `user`.
- `LoginPage.test.tsx`: mock a successful login (navigates to
  `/dashboard`), mock a `401` (shows the error banner, stays on page,
  fields keep their typed values).
- `RegisterPage.test.tsx`: mock a successful register+login chain
  (navigates to `/dashboard`), mock a `422` (shows the error banner).
- `RequireAuth.test.tsx`: updated only to wrap renders with the new
  `AuthProvider` shape (localStorage seeded or not) — its own assertions
  don't change.
- `beforeEach(() => localStorage.clear())` added wherever `AuthProvider` is
  rendered, so tests don't leak tokens across cases.

## Explicitly out of scope for this PR

- **No token-expiry countdown or auto-refresh.** `expires_in` from the
  login response is not used for anything yet (no refresh-token endpoint
  exists on the API). An expired token simply fails the next `GET
  /users/me` call and logs the user out, per the reload flow above.
- **No server-side token validation on every app load** — only the one
  `GET /users/me` call on mount when a token exists, not a periodic check.
- **No "remember me" / session-length choice** — `localStorage` always,
  per the approved design.
- **No other page's mock data (`mockItems`, `mockRequests`, etc.) is wired
  to the real API in this PR** — that's separate, later work.
- **No changes to `packages/contracts/openapi.yaml`** — nothing here
  requires a contract change.
