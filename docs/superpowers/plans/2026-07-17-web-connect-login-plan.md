# Connect Login (+ Register) to the Real API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/web`'s mock `AuthContext` with a real integration against `apps/api`'s live Auth endpoints (`POST /auth/register`, `POST /auth/login`, `GET /users/me`), so Login and Register actually authenticate against the database instead of flipping a local boolean.

**Architecture:** One new `api.ts` fetch wrapper is the only file that knows the API's base URL, request/response shapes, and error envelope. `AuthContext` is rewritten to call it, persist the JWT in `localStorage`, and derive `isAuthenticated` from token presence. `LoginPage`/`RegisterPage` become async, with a shared error-banner pattern reusing existing `destructive` design tokens.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library (mocking `global.fetch` via `vi.spyOn`, no new dependency), native `fetch`.

**Full spec:** `docs/superpowers/specs/2026-07-17-web-connect-login-design.md` — read it once for the "why" behind these choices (localStorage vs. in-memory, auto-login after register, why the token needs a lazy `useState` initializer instead of `useEffect`). This plan's tasks implement that spec exactly; if anything here seems to contradict it, the spec is the tiebreaker — flag it rather than guessing.

## Global Constraints

- Conventional Commits (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`) — one commit per task.
- TDD: write/update the test first, watch it fail for the right reason, then implement, then pass.
- Match existing code style exactly: no semicolons, single quotes, no comments except where the WHY is non-obvious.
- All existing tests must keep passing (`cd apps/web && npx vitest run`) and the build must stay clean (`cd apps/web && npx tsc -b`) after every task.
- `.env` stays gitignored (already is, at the repo root) — only `.env.example` is committed, with a placeholder value, never a real secret.
- Don't touch `apps/api` or `apps/mobile` — this plan is `apps/web` only.
- No new npm dependency — `fetch` is a browser/Vitest(jsdom) global; `vi.spyOn(global, 'fetch')` is the mocking strategy, not MSW or `axios-mock-adapter`.

---

## File Structure

New files:
- `apps/web/.env.example` — `VITE_API_URL` placeholder
- `apps/web/src/vite-env.d.ts` — types `import.meta.env.VITE_API_URL` as `string`
- `apps/web/src/lib/api.ts` — `ApiError`, `apiLogin`, `apiRegister`, `apiGetMe`
- `apps/web/src/lib/api.test.ts` — unit tests for the above

Modified files:
- `apps/web/src/lib/AuthContext.tsx` / `.test.tsx` (Task 2)
- `apps/web/src/components/RequireAuth.test.tsx` (Task 2 — `RequireAuth.tsx` itself is unchanged)
- `apps/web/src/routes/LoginPage.tsx` / `.test.tsx` (Task 3)
- `apps/web/src/routes/RegisterPage.tsx` / `.test.tsx` (Task 4)
- `apps/web/src/lib/i18n/en.ts` (Tasks 3 and 4 — new `errors` section and two `submitting` strings)

---

### Task 1: Add the `api.ts` fetch wrapper

**Files:**
- Create: `apps/web/.env.example`
- Create: `apps/web/src/vite-env.d.ts`
- Create: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Produces: `class ApiError extends Error { code: string }`, `apiLogin(email: string, password: string): Promise<{access_token: string; token_type: string; expires_in: number}>`, `apiRegister(name: string, email: string, password: string): Promise<{id: string; name: string; email: string; created_at: string}>`, `apiGetMe(token: string): Promise<{id: string; name: string; email: string; created_at: string}>`
- Consumed by: Task 2 (`AuthContext.tsx`)

- [ ] **Step 1: Create `.env.example`**

Create `apps/web/.env.example`:

```
# Copy this file to .env and fill in real local values.
# .env is gitignored — never commit it.

# Base URL of the API this app talks to (apps/api).
VITE_API_URL=http://localhost:8000
```

- [ ] **Step 2: Create `vite-env.d.ts`**

Create `apps/web/src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 3: Write the failing tests**

Create `apps/web/src/lib/api.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGetMe, apiLogin, apiRegister } from './api'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

describe('api', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('apiLogin', () => {
    it('POSTs to /auth/login and resolves with the token payload on success', async () => {
      const payload = { access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiLogin('maria@example.com', 'securepass123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'maria@example.com', password: 'securepass123' }),
        }),
      )
    })

    it('throws ApiError with the code/message from a 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401),
      )

      await expect(apiLogin('maria@example.com', 'wrong')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      })
    })
  })

  describe('apiRegister', () => {
    it('POSTs to /auth/register and resolves with the created user on success', async () => {
      const payload = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 201))

      const result = await apiRegister('María Vargas', 'maria@example.com', 'securepass123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'María Vargas', email: 'maria@example.com', password: 'securepass123' }),
        }),
      )
    })

    it('throws ApiError with the code/message from a 422 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'email: already registered' } }, 422),
      )

      await expect(apiRegister('María Vargas', 'maria@example.com', 'securepass123')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'email: already registered',
      })
    })
  })

  describe('apiGetMe', () => {
    it('GETs /users/me with a Bearer token and resolves with the profile', async () => {
      const payload = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiGetMe('tok123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/users/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
        }),
      )
    })

    it('throws ApiError on a 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401),
      )

      await expect(apiGetMe('expired-token')).rejects.toBeInstanceOf(ApiError)
    })
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: FAIL with "Cannot find module './api'".

- [ ] **Step 5: Create the implementation**

Create `apps/web/src/lib/api.ts`:

```typescript
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
  // Falls back to the API's own default dev port when VITE_API_URL isn't
  // set (e.g. running tests without a .env file) — mirrors apps/api's
  // config.py, which defaults CORS_ORIGINS the same way for local dev.
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
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

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: PASS, 6/6. `import.meta.env.VITE_API_URL` is `undefined` in the Vitest run (no `.env` file present, and Vitest doesn't read `apps/web/.env.example`), so `request()`'s fallback (`|| 'http://localhost:8000'`) is what makes the assertions on exact URLs (`'http://localhost:8000/auth/login'` etc.) pass — this is expected, not a coincidence.

- [ ] **Step 7: Run the full suite and the build**

Run: `cd apps/web && npx vitest run`
Expected: PASS (no other file imports `api.ts` yet, so nothing else changes).

Run: `cd apps/web && npx tsc -b`
Expected: exit 0, no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/.env.example apps/web/src/vite-env.d.ts apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat(web): add api.ts fetch wrapper for the Auth endpoints"
```

---

### Task 2: Rewrite `AuthContext` to use the real API

**Files:**
- Modify: `apps/web/src/lib/AuthContext.tsx`
- Modify: `apps/web/src/lib/AuthContext.test.tsx`
- Modify: `apps/web/src/components/RequireAuth.test.tsx`

**Interfaces:**
- Consumes: `ApiError`, `apiLogin`, `apiRegister`, `apiGetMe` from Task 1 (`@/lib/api`)
- Produces: `AuthProvider`, `useAuth(): { isAuthenticated: boolean; user: {id: string; name: string; email: string} | null; login: (email: string, password: string) => Promise<void>; register: (name: string, email: string, password: string) => Promise<void>; logout: () => void }`
- Consumed by: Task 3 (`LoginPage.tsx`), Task 4 (`RegisterPage.tsx`), and the already-existing `RequireAuth.tsx` (whose own code doesn't change, only its test)

- [ ] **Step 1: Write the failing tests**

Replace `apps/web/src/lib/AuthContext.test.tsx` in full:

```typescript
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function Probe() {
  const { isAuthenticated, user, login, register, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <span data-testid="user-name">{user?.name ?? ''}</span>
      <button onClick={() => login('maria@example.com', 'securepass123')}>login</button>
      <button onClick={() => register('María Vargas', 'maria@example.com', 'securepass123')}>register</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts unauthenticated when localStorage has no token', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status')).toHaveTextContent('out')
  })

  it('login() calls /auth/login then /users/me, stores the token, and sets user', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await act(async () => {
      await screen.getByText('login').click()
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
    expect(screen.getByTestId('user-name')).toHaveTextContent('María Vargas')
    expect(localStorage.getItem('rentatodo_token')).toBe('tok123')
  })

  it('register() calls /auth/register then logs in, ending authenticated', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await act(async () => {
      await screen.getByText('register').click()
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('logout() clears the token from state and localStorage', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await act(async () => {
      await screen.getByText('login').click()
    })
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))

    act(() => screen.getByText('logout').click())

    expect(screen.getByTestId('status')).toHaveTextContent('out')
    expect(localStorage.getItem('rentatodo_token')).toBeNull()
  })

  it('is authenticated on the very first render when a token already exists in localStorage', async () => {
    localStorage.setItem('rentatodo_token', 'existing-tok')
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    // No act()/await here on purpose — this asserts the FIRST synchronous render.
    expect(screen.getByTestId('status')).toHaveTextContent('in')

    await waitFor(() => expect(screen.getByTestId('user-name')).toHaveTextContent('María Vargas'))
  })

  it('logs out automatically if the stored token is rejected by /users/me', async () => {
    localStorage.setItem('rentatodo_token', 'stale-tok')
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401),
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('out'))
    expect(localStorage.getItem('rentatodo_token')).toBeNull()
  })
})
```

- [ ] **Step 2: Update `RequireAuth.test.tsx`**

`RequireAuth.tsx` itself does not change. Its test already wraps renders in `<AuthProvider>` with no token in `localStorage`, which still resolves to unauthenticated with the new implementation — but add a `beforeEach` to clear `localStorage` so no state leaks in from `AuthContext.test.tsx` when the suite runs together. Replace `apps/web/src/components/RequireAuth.test.tsx` in full:

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { RequireAuth } from './RequireAuth'

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <div>Protected dashboard</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('redirects to /login when not authenticated', () => {
    renderAt('/dashboard')
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run src/lib/AuthContext.test.tsx src/components/RequireAuth.test.tsx`
Expected: FAIL — `login`/`register` still take the old zero-arg signature, no `localStorage` interaction exists yet.

- [ ] **Step 4: Rewrite the implementation**

Replace `apps/web/src/lib/AuthContext.tsx` in full:

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiGetMe, apiLogin, apiRegister } from './api'

const TOKEN_KEY = 'rentatodo_token'

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

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(null)

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
  }

  useEffect(() => {
    if (!token) return
    apiGetMe(token)
      .then((profile) => setUser({ id: profile.id, name: profile.name, email: profile.email }))
      .catch(() => logout())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(email: string, password: string) {
    const result = await apiLogin(email, password)
    setToken(result.access_token)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    const profile = await apiGetMe(result.access_token)
    setUser({ id: profile.id, name: profile.name, email: profile.email })
  }

  async function register(name: string, email: string, password: string) {
    await apiRegister(name, email, password)
    await login(email, password)
  }

  const value: AuthContextValue = {
    isAuthenticated: token !== null,
    user,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

Note the mount-time `useEffect` intentionally runs only once (empty dependency array) and intentionally does not include `token`/`logout` in its dependency array — it exists solely to validate a token that was already present at first render (from the lazy `useState` initializer), not to react to `login()`/`logout()` calls afterward (which manage `user` themselves). The `eslint-disable` comment documents that this is deliberate, matching this file's own established pattern of commenting only where the WHY is non-obvious.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run src/lib/AuthContext.test.tsx src/components/RequireAuth.test.tsx`
Expected: PASS, 6/6 and 1/1.

- [ ] **Step 6: Run the full suite and the build**

Run: `cd apps/web && npx vitest run`
Expected: FAIL only in `LoginPage.test.tsx` and `RegisterPage.test.tsx` — those still call the old `login()`/no-op signatures and are Task 3/4's job, not this task's. Confirm no OTHER file fails.

Run: `cd apps/web && npx tsc -b`
Expected: exit 0. (`LoginPage.tsx`/`RegisterPage.tsx` still compile against the new `AuthContextValue` type even though their own runtime behavior is stale — `login()`/`register()` are still valid function references, just called with the old argument count, which TypeScript will actually flag as a type error since `login` now requires 2 arguments. If `tsc -b` fails here, that's expected and will be fixed by Tasks 3/4 — note this in your report rather than treating it as this task's bug.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/AuthContext.tsx apps/web/src/lib/AuthContext.test.tsx apps/web/src/components/RequireAuth.test.tsx
git commit -m "feat(web): connect AuthContext to the real Auth API"
```

---

### Task 3: Connect `LoginPage` to the real API

**Files:**
- Modify: `apps/web/src/routes/LoginPage.tsx`
- Modify: `apps/web/src/routes/LoginPage.test.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `useAuth()` (new `login(email, password): Promise<void>` signature) from Task 2, `ApiError` from Task 1 (`@/lib/api`)

- [ ] **Step 1: Add new i18n strings**

In `apps/web/src/lib/i18n/en.ts`, update the `login` section (currently lines 18-23):

```typescript
  login: {
    title: 'Sign in',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
  },
```

to:

```typescript
  login: {
    title: 'Sign in',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
  },
```

Then add a new top-level `errors` section. Find the end of the top-level dictionary object (the closing `}` that matches the object literal's opening `{` right after `export const en = {`) and add, as a new top-level key alongside `login`, `register`, `calendar`, etc.:

```typescript
  errors: {
    network: "Couldn't reach the server. Check your connection and try again.",
  },
```

- [ ] **Step 2: Write the failing tests**

Replace `apps/web/src/routes/LoginPage.test.tsx` in full:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { LoginPage } from './LoginPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function StatusProbe() {
  const { isAuthenticated } = useAuth()
  return <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
}

function renderPage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <StatusProbe />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('authenticates and navigates to /dashboard on a successful submit', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
  })

  it('shows the API error message and stays on the page on invalid credentials', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401),
    )
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(screen.getByText('Invalid email or password')).toBeInTheDocument())
    expect(screen.getByTestId('status')).toHaveTextContent('out')
    expect(screen.getByLabelText('Email')).toHaveValue('maria@example.com')
  })

  it('disables the submit button and shows a loading label while the request is in flight', async () => {
    const user = userEvent.setup()
    let resolveLogin: (value: Response) => void = () => {}
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()

    resolveLogin(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run src/routes/LoginPage.test.tsx`
Expected: FAIL — `handleSubmit` still calls the old zero-arg `login()`.

- [ ] **Step 4: Rewrite the implementation**

Replace `apps/web/src/routes/LoginPage.tsx` in full:

```typescript
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { ApiError } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const t = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.errors.network)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-three rounded-lg border border-border bg-card p-four">
        <h1 className="font-display text-lg font-semibold text-foreground">{t.login.title}</h1>
        {error && <p className="rounded-md bg-destructive/10 p-two text-sm text-destructive">{error}</p>}
        <div className="space-y-half">
          <Label htmlFor="email">{t.login.email}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="password">{t.login.password}</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t.login.submitting : t.login.submit}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/LoginPage.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 6: Run the full suite and the build**

Run: `cd apps/web && npx vitest run`
Expected: FAIL only in `RegisterPage.test.tsx` (Task 4's job). Confirm nothing else fails.

Run: `cd apps/web && npx tsc -b`
Expected: exit 0, unless `RegisterPage.tsx` still references the old `register`-less flow in a way that breaks compilation — if so, note it, that's expected until Task 4.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/LoginPage.tsx apps/web/src/routes/LoginPage.test.tsx apps/web/src/lib/i18n/en.ts
git commit -m "feat(web): connect LoginPage to the real Auth API"
```

---

### Task 4: Connect `RegisterPage` to the real API (auto-login on success)

**Files:**
- Modify: `apps/web/src/routes/RegisterPage.tsx`
- Modify: `apps/web/src/routes/RegisterPage.test.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `useAuth()` (new `register(name, email, password): Promise<void>` signature) from Task 2, `ApiError` from Task 1 (`@/lib/api`)

- [ ] **Step 1: Add the new i18n string**

In `apps/web/src/lib/i18n/en.ts`, update the `register` section (currently lines 24-30):

```typescript
  register: {
    title: 'Create account',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    submit: 'Create account',
  },
```

to:

```typescript
  register: {
    title: 'Create account',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    submit: 'Create account',
    submitting: 'Creating account…',
  },
```

(The `errors.network` key was already added in Task 3 — this task reuses it, no further i18n additions needed.)

- [ ] **Step 2: Write the failing tests**

Replace `apps/web/src/routes/RegisterPage.test.tsx` in full:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { RegisterPage } from './RegisterPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function StatusProbe() {
  const { isAuthenticated } = useAuth()
  return <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
}

function renderPage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/register']}>
        <StatusProbe />
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers, auto-logs-in, and navigates straight to /dashboard', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
  })

  it('shows the API error message and stays on the page when the email is already registered', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'email: already registered' } }, 422),
    )
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(screen.getByText('email: already registered')).toBeInTheDocument())
    expect(screen.getByTestId('status')).toHaveTextContent('out')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run src/routes/RegisterPage.test.tsx`
Expected: FAIL — `handleSubmit` still just navigates to `/login` without calling anything.

- [ ] **Step 4: Rewrite the implementation**

Replace `apps/web/src/routes/RegisterPage.tsx` in full:

```typescript
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { ApiError } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const t = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register(name, email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.errors.network)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-three rounded-lg border border-border bg-card p-four">
        <h1 className="font-display text-lg font-semibold text-foreground">{t.register.title}</h1>
        {error && <p className="rounded-md bg-destructive/10 p-two text-sm text-destructive">{error}</p>}
        <div className="space-y-half">
          <Label htmlFor="name">{t.register.name}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="email">{t.register.email}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="password">{t.register.password}</Label>
          <Input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t.register.submitting : t.register.submit}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/RegisterPage.test.tsx`
Expected: PASS, 2/2.

- [ ] **Step 6: Run the full suite and the build**

Run: `cd apps/web && npx vitest run`
Expected: PASS, every test file.

Run: `cd apps/web && npx tsc -b`
Expected: exit 0, no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/RegisterPage.tsx apps/web/src/routes/RegisterPage.test.tsx apps/web/src/lib/i18n/en.ts
git commit -m "feat(web): connect RegisterPage to the real Auth API, auto-login on success"
```

---

## Post-plan state

Login and Register both authenticate against the real `apps/api` (`POST /auth/login`, `POST /auth/register`, `GET /users/me`). The JWT persists in `localStorage` across reloads without a flash of the login page for an already-authenticated user. Every other page in `apps/web` (Items, Requests, Calendar, Earnings) still runs on `mockItems`/`mockRequests` via `ItemsContext`/`RequestsContext` — connecting those to the real API is separate, later work, same as the design spec's "Explicitly out of scope" section states.

To run this against a real backend locally: start `apps/api` per its own README/CLAUDE.md, copy `apps/web/.env.example` to `apps/web/.env`, and start the web dev server (`npm run dev` in `apps/web`, or however this repo's scripts are wired) — it already runs on port 8081, matching the API's default `CORS_ORIGINS`.
