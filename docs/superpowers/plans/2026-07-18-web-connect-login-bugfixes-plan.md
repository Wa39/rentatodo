# Web Connect-Login — Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 9 confirmed findings from a `/code-review high` pass across the whole of `apps/web` (logged in the review that produced this plan — no separate follow-ups doc was written since this plan captures them directly), run against branch `feature/web-connect-login` (Login/Register/AuthContext wired to the real `apps/api` Auth endpoints, never yet reviewed or PR'd).

**Architecture:** No new architecture — every fix is local to the file it's in, except Task 7, which extracts two tiny shared presentational pieces (`AuthBrandHeader`, `AuthErrorBanner`) and one shared helper (`getErrorMessage`) out of `LoginPage`/`RegisterPage`'s duplicated markup. Tasks are ordered so `api.ts`'s error-parsing fix (Task 1) lands before `AuthContext`'s mount-effect fix (Task 2), since Task 2 depends on `ApiError` being reliably thrown for every non-ok response.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library, react-router-dom v6. No new dependencies.

## Global Constraints

- Conventional Commits (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`) — one commit per task.
- TDD: write/update the failing test first, run it to confirm it fails for the right reason, then make it pass.
- Match existing code style exactly: no semicolons, single quotes, no comments except where the WHY is non-obvious (this codebase has almost none — don't add any beyond what's shown below).
- All existing tests must keep passing after each task (`cd apps/web && npx vitest run`).
- Don't touch `apps/api` or `apps/mobile` — this plan is `apps/web` only.
- All commands below assume the working directory is `D:\Programacion\rentatodo\.worktrees\web-connect-login` (this branch's dedicated worktree), with `cd apps/web` prefixed for any `npx` command, matching how the rest of this repo's plans are written.

---

### Task 1: `api.ts` — never let a malformed error body escape as a raw TypeError

**Bug:** `request()` unconditionally reads `body.error.code` / `body.error.message` on any non-ok response. A response that doesn't carry that exact envelope (an unhandled 500 producing FastAPI's default `{"detail": "..."}` body, a reverse-proxy error page) throws a plain `TypeError` instead of `ApiError`, which every caller's `err instanceof ApiError` check misses — silently mislabeling a real server error as a generic network failure.

**Files:**
- Modify: `apps/web/src/lib/api.ts:23-37`
- Test: `apps/web/src/lib/api.test.ts` (add a case)

**Interfaces:**
- No signature changes — `request()`'s behavior on a malformed error body is the only change: it now always throws `ApiError`, never a raw parse/property-access error.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/api.test.ts`, inside the `describe('apiLogin', ...)` block, after the existing `'throws ApiError with the code/message from a 401 response'` test:

```typescript
    it('throws a generic ApiError instead of a raw TypeError when the error body has no error envelope', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: 'Internal Server Error' }, 500))

      await expect(apiLogin('maria@example.com', 'securepass123')).rejects.toBeInstanceOf(ApiError)
    })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'code')`, not an `ApiError`.

- [ ] **Step 3: Fix the implementation**

In `apps/web/src/lib/api.ts`, replace lines 23-37:

```typescript
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
```

with:

```typescript
async function request<T>(path: string, options: RequestInit): Promise<T> {
  // Falls back to the API's own default dev port when VITE_API_URL isn't
  // set (e.g. running tests without a .env file) — mirrors apps/api's
  // config.py, which defaults CORS_ORIGINS the same way for local dev.
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'UNKNOWN_ERROR', body?.error?.message ?? 'Something went wrong. Please try again.')
  }
  return body as T
}
```

(The hardcoded fallback URL is addressed separately in Task 6 — this task only fixes error-body parsing.)

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "fix(web): never throw a raw TypeError on a malformed API error body"
```

---

### Task 2: `AuthContext` — mount-effect only logs out on an actual invalid token, not a network hiccup

**Bug:** The mount-time effect that re-validates a stored token calls `logout()` on *any* `apiGetMe` rejection — including a transient network failure or a 5xx unrelated to the token's validity — silently destroying a perfectly valid session on a momentary connectivity blip.

**Files:**
- Modify: `apps/web/src/lib/AuthContext.tsx:1-2,32-38`
- Test: `apps/web/src/lib/AuthContext.test.tsx` (add a case)

**Interfaces:**
- No signature changes — only the mount effect's `.catch()` behavior changes.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/AuthContext.test.tsx`, after the existing `'logs out automatically if the stored token is rejected by /users/me'` test:

```typescript
  it('keeps the session when the profile check fails for a reason other than an invalid token', async () => {
    localStorage.setItem('rentatodo_token', 'still-valid-tok')
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.getByTestId('status')).toHaveTextContent('in')
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(localStorage.getItem('rentatodo_token')).toBe('still-valid-tok')
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/AuthContext.test.tsx`
Expected: FAIL — the current `.catch(() => logout())` clears the token unconditionally, so `localStorage.getItem('rentatodo_token')` is `null`.

- [ ] **Step 3: Fix the implementation**

In `apps/web/src/lib/AuthContext.tsx`, replace line 2:

```typescript
import { apiGetMe, apiLogin, apiRegister } from './api'
```

with:

```typescript
import { apiGetMe, apiLogin, apiRegister, ApiError } from './api'
```

Then replace lines 32-38:

```typescript
  useEffect(() => {
    if (!token) return
    apiGetMe(token)
      .then((profile) => setUser({ id: profile.id, name: profile.name, email: profile.email }))
      .catch(() => logout())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

with:

```typescript
  useEffect(() => {
    if (!token) return
    apiGetMe(token)
      .then((profile) => setUser({ id: profile.id, name: profile.name, email: profile.email }))
      .catch((err) => {
        if (err instanceof ApiError) logout()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/AuthContext.test.tsx`
Expected: PASS, all cases including the existing `'logs out automatically if the stored token is rejected by /users/me'` test (that test's mocked 401 response has a proper `{error:{code,message}}` envelope, so it parses to `ApiError` and still logs out correctly).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/AuthContext.tsx apps/web/src/lib/AuthContext.test.tsx
git commit -m "fix(web): only auto-logout on an invalid token, not a network failure"
```

---

### Task 3: `AuthContext` — `login()` rolls back if the profile fetch fails after a fresh login

**Bug:** `login()` stores the freshly issued token in state and `localStorage` *before* fetching the profile. If that `apiGetMe` call then fails, the error propagates to the caller (shown as a banner on `LoginPage`), but the token is never cleared — `isAuthenticated` (`token !== null`) stays permanently `true` while `user` stays `null` forever, with no retry path. `register()` calls `login()` internally, so it inherits the exact same gap for brand-new accounts.

**Files:**
- Modify: `apps/web/src/lib/AuthContext.tsx:40-46`
- Test: `apps/web/src/lib/AuthContext.test.tsx` (add a case)

**Interfaces:**
- No signature changes — `login()` still returns `Promise<void>` and still throws on failure; it now also cleans up after itself before rethrowing.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/AuthContext.test.tsx`, after the test added in Task 2:

```typescript
  it('rolls back the token if the profile fetch fails right after a successful login', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await expect(
      act(async () => {
        await screen.getByText('login').click()
      }),
    ).rejects.toThrow()

    expect(screen.getByTestId('status')).toHaveTextContent('out')
    expect(localStorage.getItem('rentatodo_token')).toBeNull()
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/AuthContext.test.tsx`
Expected: FAIL — `status` stays `'in'` and `localStorage` still holds `'tok123'`.

- [ ] **Step 3: Fix the implementation**

In `apps/web/src/lib/AuthContext.tsx`, replace lines 40-46:

```typescript
  async function login(email: string, password: string) {
    const result = await apiLogin(email, password)
    setToken(result.access_token)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    const profile = await apiGetMe(result.access_token)
    setUser({ id: profile.id, name: profile.name, email: profile.email })
  }
```

with:

```typescript
  async function login(email: string, password: string) {
    const result = await apiLogin(email, password)
    setToken(result.access_token)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    try {
      const profile = await apiGetMe(result.access_token)
      setUser({ id: profile.id, name: profile.name, email: profile.email })
    } catch (err) {
      logout()
      throw err
    }
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/AuthContext.test.tsx`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/AuthContext.tsx apps/web/src/lib/AuthContext.test.tsx
git commit -m "fix(web): roll back the stored token if login's profile fetch fails"
```

---

### Task 4: `DashboardLayout` — show the real authenticated user, not the static mock user

**Bug:** The sidebar footer renders `mockUser.name` / `getInitials(mockUser.name)` from the static mock-data module instead of the real profile `AuthContext` now holds. Every logged-in user sees the same hardcoded fake name and initials regardless of who actually authenticated.

**Files:**
- Modify: `apps/web/src/layouts/DashboardLayout.tsx:1-11,99-104`
- Test: `apps/web/src/layouts/DashboardLayout.test.tsx` (add a case)

**Interfaces:**
- No new exports — internal rendering fix only.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/layouts/DashboardLayout.test.tsx`, add `waitFor` to the existing `@testing-library/react` import and add a `jsonResponse` helper and `beforeEach`/`afterEach` for `fetch`/`localStorage`, then a new test. Replace lines 1-24:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { DashboardLayout } from './DashboardLayout'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function renderLayout() {
  render(
    <AuthProvider>
      <RequestsProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<div>Home content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

```

Then add this test at the end of the `describe('DashboardLayout', ...)` block, right before its closing `})`:

```typescript

  it("shows the authenticated user's real name and initials, not the mock user", async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      jsonResponse({ id: 'u1', name: 'Ana Torres', email: 'ana@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
    )

    renderLayout()

    await waitFor(() => expect(screen.getByText('Ana Torres')).toBeInTheDocument())
    expect(screen.getByText('AT')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/layouts/DashboardLayout.test.tsx`
Expected: FAIL — the sidebar shows the mock user's name (`mockUser.name`), not `'Ana Torres'`.

- [ ] **Step 3: Fix the implementation**

In `apps/web/src/layouts/DashboardLayout.tsx`, replace lines 1-7:

```typescript
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Calendar, DollarSign, LayoutGrid, MessageSquare, Package, Plus } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useTranslation } from '@/lib/i18n'
import { formatCentavos, getInitials } from '@/lib/format'
import { mockEarnings, mockUser } from '@/lib/mockData'
import { useRequests } from '@/lib/RequestsContext'
```

with:

```typescript
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Calendar, DollarSign, LayoutGrid, MessageSquare, Package, Plus } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useTranslation } from '@/lib/i18n'
import { formatCentavos, getInitials } from '@/lib/format'
import { mockEarnings } from '@/lib/mockData'
import { useRequests } from '@/lib/RequestsContext'
```

Replace line 11:

```typescript
  const { logout } = useAuth()
```

with:

```typescript
  const { logout, user } = useAuth()
```

Then replace lines 99-104:

```typescript
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-warning-ink">
            {getInitials(mockUser.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{mockUser.name}</div>
            <div className="text-xs text-sidebar-foreground/60">{t.nav.ownerRole}</div>
          </div>
```

with:

```typescript
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-warning-ink">
            {getInitials(user?.name ?? '')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user?.name}</div>
            <div className="text-xs text-sidebar-foreground/60">{t.nav.ownerRole}</div>
          </div>
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/layouts/DashboardLayout.test.tsx`
Expected: PASS, all cases.

- [ ] **Step 5: Run the full suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/layouts/DashboardLayout.tsx apps/web/src/layouts/DashboardLayout.test.tsx
git commit -m "fix(web): show the real authenticated user in the sidebar, not the mock user"
```

---

### Task 5: `CalendarPage` — guard against zero items

**Bug:** `selectedItem` is asserted non-null (`selectedItem!`) but is genuinely `undefined` when `items` is empty and no `?item=` param is present — `items[0]` is `undefined`, the existing `requestedId && !selectedItem` guard never runs (`requestedId` is `null`), and execution falls through to `selectedItem!.id`/`selectedItem!.name`, crashing the page. Not reachable today only because mock data always seeds items.

**Files:**
- Modify: `apps/web/src/routes/CalendarPage.tsx:11-44`
- Modify: `apps/web/src/lib/i18n/en.ts:48-52`
- Test: `apps/web/src/routes/CalendarPage.test.tsx` (add a case)

**Interfaces:**
- No new exports — internal guard only.

- [ ] **Step 1: Add the `noItems` string to the dictionary**

In `apps/web/src/lib/i18n/en.ts`, inside the `calendar` object, add a new key after `itemNotFound`:

```typescript
  calendar: {
    title: 'Calendar',
    subtitle: 'Availability by date, item by item.',
    itemNotFound: "This item doesn't exist or is no longer yours.",
    noItems: "You don't have any items yet. Publish one to see its calendar.",
    weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
```

- [ ] **Step 2: Write the failing test**

Add to `apps/web/src/routes/CalendarPage.test.tsx`, at the end of the `describe('CalendarPage', ...)` block:

```typescript

  it('shows an empty-state message instead of crashing when there are no items at all', async () => {
    vi.resetModules()
    vi.doMock('@/lib/mockData', async () => {
      const actual = await vi.importActual<typeof import('@/lib/mockData')>('@/lib/mockData')
      return { ...actual, mockItems: [] }
    })
    const itemsModule = await import('@/lib/ItemsContext')
    const requestsModule = await import('@/lib/RequestsContext')
    const { CalendarPage: PatchedPage } = await import('./CalendarPage')

    render(
      <requestsModule.RequestsProvider>
        <itemsModule.ItemsProvider>
          <MemoryRouter initialEntries={['/requests/calendar']}>
            <Routes>
              <Route path="/requests/calendar" element={<PatchedPage />} />
            </Routes>
          </MemoryRouter>
        </itemsModule.ItemsProvider>
      </requestsModule.RequestsProvider>,
    )

    expect(screen.getByText("You don't have any items yet. Publish one to see its calendar.")).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    vi.doUnmock('@/lib/mockData')
  })
```

Add `vi` to the existing `vitest` import at the top of the file: `import { describe, expect, it, vi } from 'vitest'`.

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/routes/CalendarPage.test.tsx`
Expected: FAIL — the page currently throws (`Cannot read properties of undefined (reading 'id')`) instead of rendering the empty-state text.

- [ ] **Step 4: Fix the implementation**

In `apps/web/src/routes/CalendarPage.tsx`, replace lines 11-44:

```typescript
export function CalendarPage() {
  const t = useTranslation()
  const { items } = useItems()
  const { requests } = useRequests()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedId = searchParams.get('item')
  const selectedItem = requestedId ? items.find((i) => i.id === requestedId) : items[0]

  const dateRanges = useMemo(
    () => (selectedItem ? getItemDateStates(selectedItem.id, requests) : []),
    [selectedItem, requests],
  )
  const itemReservations = useMemo(
    () => (selectedItem ? requests.filter((r) => r.item_id === selectedItem.id) : []),
    [selectedItem, requests],
  )

  const now = new Date()
  const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const secondMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  function handleSelect(event: ChangeEvent<HTMLSelectElement>) {
    setSearchParams({ item: event.target.value })
  }

  if (requestedId && !selectedItem) {
    return (
      <div>
        <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />
        <div className="p-four text-sm text-muted-foreground">{t.calendar.itemNotFound}</div>
      </div>
    )
  }
```

with:

```typescript
export function CalendarPage() {
  const t = useTranslation()
  const { items } = useItems()
  const { requests } = useRequests()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedId = searchParams.get('item')
  const selectedItem = items.length === 0 ? undefined : requestedId ? items.find((i) => i.id === requestedId) : items[0]

  const dateRanges = useMemo(
    () => (selectedItem ? getItemDateStates(selectedItem.id, requests) : []),
    [selectedItem, requests],
  )
  const itemReservations = useMemo(
    () => (selectedItem ? requests.filter((r) => r.item_id === selectedItem.id) : []),
    [selectedItem, requests],
  )

  const now = new Date()
  const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const secondMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  function handleSelect(event: ChangeEvent<HTMLSelectElement>) {
    setSearchParams({ item: event.target.value })
  }

  if (items.length === 0) {
    return (
      <div>
        <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />
        <div className="p-four text-sm text-muted-foreground">{t.calendar.noItems}</div>
      </div>
    )
  }

  if (requestedId && !selectedItem) {
    return (
      <div>
        <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />
        <div className="p-four text-sm text-muted-foreground">{t.calendar.itemNotFound}</div>
      </div>
    )
  }
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/routes/CalendarPage.test.tsx`
Expected: PASS, all cases.

- [ ] **Step 6: Run the full suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/CalendarPage.tsx apps/web/src/routes/CalendarPage.test.tsx apps/web/src/lib/i18n/en.ts
git commit -m "fix(web): show an empty state on the calendar instead of crashing with zero items"
```

---

### Task 6: `api.ts` — stop hardcoding the localhost fallback URL

**Bug:** `CLAUDE.md`'s Security rules state "No hardcoded URLs, IPs, or credentials in source code" and "Always use environment variables." `request()`'s `import.meta.env.VITE_API_URL || 'http://localhost:8000'` bakes a literal URL into the bundle instead of requiring the env var, same as `apps/api`'s own `Settings` class requires `database_url`/`jwt_secret` with no default.

**Files:**
- Modify: `apps/web/src/lib/api.ts:23-27`
- Modify: `apps/web/src/test/setup.ts`

**Interfaces:**
- No signature changes — `VITE_API_URL` becomes required at runtime; tests supply it via `vi.stubEnv` in the shared setup file instead of relying on a source-level default.

- [ ] **Step 1: Stub the env var in the shared test setup**

In `apps/web/src/test/setup.ts`, add this import and call at the top of the file (before the existing `undici` import):

```typescript
import { vi } from 'vitest'

vi.stubEnv('VITE_API_URL', 'http://localhost:8000')
```

- [ ] **Step 2: Run the full suite to confirm the stub alone doesn't change anything yet**

Run: `cd apps/web && npx vitest run`
Expected: PASS (the source fallback is still in place, so behavior is unchanged; this just proves the stub works before removing the fallback in Step 3).

- [ ] **Step 3: Remove the hardcoded fallback**

In `apps/web/src/lib/api.ts`, replace lines 23-27:

```typescript
async function request<T>(path: string, options: RequestInit): Promise<T> {
  // Falls back to the API's own default dev port when VITE_API_URL isn't
  // set (e.g. running tests without a .env file) — mirrors apps/api's
  // config.py, which defaults CORS_ORIGINS the same way for local dev.
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

with:

```typescript
async function request<T>(path: string, options: RequestInit): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL
```

- [ ] **Step 4: Run the full suite to verify nothing broke**

Run: `cd apps/web && npx vitest run`
Expected: PASS — every test now gets `VITE_API_URL` from the stub in `test/setup.ts` instead of the removed source-level fallback.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/test/setup.ts
git commit -m "fix(web): require VITE_API_URL instead of hardcoding a localhost fallback"
```

---

### Task 7: Extract shared `AuthBrandHeader` and `AuthErrorBanner`, dedupe error-message extraction

**Cleanup:** `LoginPage` and `RegisterPage` duplicate the brand header block, the error-banner markup, and the `err instanceof ApiError ? err.message : t.errors.network` ternary verbatim. The codebase already extracts shared pieces elsewhere (`PageHeader`, `StatusBadge`) — these two pages bypass that pattern.

**Files:**
- Create: `apps/web/src/components/AuthBrandHeader.tsx`
- Create: `apps/web/src/components/AuthErrorBanner.tsx`
- Modify: `apps/web/src/lib/api.ts` (add `getErrorMessage`)
- Modify: `apps/web/src/routes/LoginPage.tsx`
- Modify: `apps/web/src/routes/RegisterPage.tsx`
- Test: `apps/web/src/components/AuthBrandHeader.test.tsx` (create)
- Test: `apps/web/src/components/AuthErrorBanner.test.tsx` (create)

**Interfaces:**
- Produces: `AuthBrandHeader(): JSX.Element`, `AuthErrorBanner({ message }: { message: string | null }): JSX.Element | null`, `getErrorMessage(err: unknown, fallback: string): string` (exported from `lib/api.ts`, alongside `ApiError`).
- Consumed by: `LoginPage`, `RegisterPage`.

- [ ] **Step 1: Write the failing tests for the two new components**

Create `apps/web/src/components/AuthBrandHeader.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthBrandHeader } from './AuthBrandHeader'

describe('AuthBrandHeader', () => {
  it('renders the RentaTodo brand name', () => {
    render(<AuthBrandHeader />)
    expect(screen.getByText('RentaTodo')).toBeInTheDocument()
  })
})
```

Create `apps/web/src/components/AuthErrorBanner.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthErrorBanner } from './AuthErrorBanner'

describe('AuthErrorBanner', () => {
  it('renders nothing when message is null', () => {
    const { container } = render(<AuthErrorBanner message={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the message when set', () => {
    render(<AuthErrorBanner message="Invalid email or password" />)
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/web && npx vitest run src/components/AuthBrandHeader.test.tsx src/components/AuthErrorBanner.test.tsx`
Expected: FAIL — `Cannot find module './AuthBrandHeader'` / `'./AuthErrorBanner'`.

- [ ] **Step 3: Create the two components**

Create `apps/web/src/components/AuthBrandHeader.tsx`:

```typescript
export function AuthBrandHeader() {
  return (
    <div className="flex items-center gap-two">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary-foreground font-display text-base font-bold text-primary-foreground">
        R
      </div>
      <span className="font-display text-base font-semibold text-foreground">RentaTodo</span>
    </div>
  )
}
```

Create `apps/web/src/components/AuthErrorBanner.tsx`:

```typescript
export function AuthErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="rounded-md bg-destructive/10 p-two text-sm text-destructive">{message}</p>
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd apps/web && npx vitest run src/components/AuthBrandHeader.test.tsx src/components/AuthErrorBanner.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 5: Add `getErrorMessage` to `api.ts`**

In `apps/web/src/lib/api.ts`, add this function after the `ApiError` class definition (before `interface LoginResult`):

```typescript
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}
```

- [ ] **Step 6: Migrate `LoginPage` to the shared pieces**

Replace `apps/web/src/routes/LoginPage.tsx` in full:

```typescript
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { getErrorMessage } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { AuthBrandHeader } from '@/components/AuthBrandHeader'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
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
      setError(getErrorMessage(err, t.errors.network))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-four bg-background">
      <AuthBrandHeader />
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-three rounded-lg border border-border bg-card p-four">
        <h1 className="font-display text-lg font-semibold text-foreground">{t.login.title}</h1>
        <AuthErrorBanner message={error} />
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
        <p className="text-center text-sm text-muted-foreground">
          {t.login.noAccountPrompt}{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t.login.registerLink}
          </Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Run `LoginPage.test.tsx` to verify nothing broke**

Run: `cd apps/web && npx vitest run src/routes/LoginPage.test.tsx`
Expected: PASS, all cases (the tests query by label/role/text, none of which changed).

- [ ] **Step 8: Migrate `RegisterPage` to the shared pieces**

Replace `apps/web/src/routes/RegisterPage.tsx` in full:

```typescript
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { getErrorMessage } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { AuthBrandHeader } from '@/components/AuthBrandHeader'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function getPasswordError(password: string, t: ReturnType<typeof useTranslation>): string | null {
  if (password.length < 8) return t.register.passwordTooShort
  if (/\d{5,}/.test(password)) return t.register.passwordConsecutiveDigits
  return null
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const t = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const passwordError = password.length > 0 ? getPasswordError(password, t) : null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (passwordError) {
      // Don't also set `error` here — `passwordError` above already renders
      // this exact message inline under the field; setting both would show
      // the same text twice on screen.
      return
    }
    setSubmitting(true)
    try {
      await register(name, email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(getErrorMessage(err, t.errors.network))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-four bg-background">
      <AuthBrandHeader />
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-three rounded-lg border border-border bg-card p-four">
        <h1 className="font-display text-lg font-semibold text-foreground">{t.register.title}</h1>
        <AuthErrorBanner message={error} />
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
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t.register.submitting : t.register.submit}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t.register.hasAccountPrompt}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t.register.loginLink}
          </Link>
        </p>
      </form>
    </div>
  )
}
```

(This also fixes Task 8's finding inline — `handleSubmit` now checks the already-computed `passwordError` instead of calling `getPasswordError` a second time. See Task 8 below; if executed after this task, Task 8 becomes a no-op check rather than a separate change.)

- [ ] **Step 9: Run `RegisterPage.test.tsx` to verify nothing broke**

Run: `cd apps/web && npx vitest run src/routes/RegisterPage.test.tsx`
Expected: PASS, all cases.

- [ ] **Step 10: Run the full suite and the build**

Run: `cd apps/web && npx vitest run`
Expected: PASS, every test file.

Run: `cd apps/web && npx tsc -b`
Expected: exit 0, no errors.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/AuthBrandHeader.tsx apps/web/src/components/AuthBrandHeader.test.tsx apps/web/src/components/AuthErrorBanner.tsx apps/web/src/components/AuthErrorBanner.test.tsx apps/web/src/lib/api.ts apps/web/src/routes/LoginPage.tsx apps/web/src/routes/RegisterPage.tsx
git commit -m "refactor(web): extract shared AuthBrandHeader/AuthErrorBanner, dedupe error handling"
```

---

### Task 8: `RegisterPage` — confirm `passwordError` reuse (no-op if Task 7 already ran)

**Bug:** `handleSubmit` recomputes `getPasswordError(password, t)` from scratch instead of reusing the already-computed `passwordError` value — pure duplicated work with no behavioral difference.

**Files:**
- Modify: `apps/web/src/routes/RegisterPage.tsx` (only if Task 7 wasn't executed first)

- [ ] **Step 1: Check whether this is already fixed**

Run: `cd apps/web && grep -n "if (passwordError)" src/routes/RegisterPage.tsx`

If this prints a match, Task 7's rewrite already applied this fix — skip straight to Step 3 (nothing to commit).

If it prints nothing (i.e. `handleSubmit` still calls `if (getPasswordError(password, t))`), continue to Step 2.

- [ ] **Step 2: Fix the implementation**

In `apps/web/src/routes/RegisterPage.tsx`, replace:

```typescript
    if (getPasswordError(password, t)) {
```

with:

```typescript
    if (passwordError) {
```

Run: `cd apps/web && npx vitest run src/routes/RegisterPage.test.tsx`
Expected: PASS, all cases (behavior is identical — `passwordError` and a fresh `getPasswordError(password, t)` call are always equal at this point in `handleSubmit`, since `password` hasn't changed between render and submit).

Commit:

```bash
git add apps/web/src/routes/RegisterPage.tsx
git commit -m "refactor(web): reuse passwordError instead of recomputing it in handleSubmit"
```

- [ ] **Step 3: Confirm and move on**

Nothing further needed — proceed to Task 9.

---

### Task 9: `AuthContext.register()` — drop the redundant profile re-fetch

**Bug:** `apiRegister` already returns the full `UserProfile` (id/name/email/created_at). `register()` discards that return value and calls `login()`, which performs `apiLogin` *and* a second `apiGetMe` call — refetching a profile the app already has. Only the `apiLogin` call is actually necessary (register's response carries no token); the trailing `apiGetMe` is an avoidable extra network round trip on every signup.

**Files:**
- Modify: `apps/web/src/lib/AuthContext.tsx:48-51`
- Modify: `apps/web/src/lib/AuthContext.test.tsx` (update the `register()` test's fetch-call-count assertion)
- Modify: `apps/web/src/routes/RegisterPage.test.tsx` (update two tests' mocked fetch sequences)

**Interfaces:**
- No signature changes — `register()` still returns `Promise<void>` and still ends with `isAuthenticated === true` and `user` populated. Only the number of network calls it makes changes (3 → 2).

- [ ] **Step 1: Update the failing test in `AuthContext.test.tsx`**

In `apps/web/src/lib/AuthContext.test.tsx`, replace the `'register() calls /auth/register then logs in, ending authenticated'` test's body:

```typescript
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
```

with:

```typescript
  it('register() calls /auth/register then /auth/login, ending authenticated without an extra profile re-fetch', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await act(async () => {
      await screen.getByText('register').click()
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
    expect(screen.getByTestId('user-name')).toHaveTextContent('María Vargas')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/AuthContext.test.tsx`
Expected: FAIL — the current implementation makes a 3rd call (`apiGetMe`), so with only 2 mocked responses queued, the 3rd `fetch` call has no mock left and the test hangs/rejects, or `toHaveBeenCalledTimes(2)` fails with `3`.

- [ ] **Step 3: Fix the implementation**

In `apps/web/src/lib/AuthContext.tsx`, replace lines 48-51:

```typescript
  async function register(name: string, email: string, password: string) {
    await apiRegister(name, email, password)
    await login(email, password)
  }
```

with:

```typescript
  async function register(name: string, email: string, password: string) {
    const profile = await apiRegister(name, email, password)
    const result = await apiLogin(email, password)
    setToken(result.access_token)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    setUser({ id: profile.id, name: profile.name, email: profile.email })
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/AuthContext.test.tsx`
Expected: PASS, all cases.

- [ ] **Step 5: Update `RegisterPage.test.tsx`'s two tests that mock 3 fetch calls**

In `apps/web/src/routes/RegisterPage.test.tsx`, in both `'registers, auto-logs-in, and navigates straight to /dashboard'` and `'allows a password with up to 4 consecutive digits'`, remove the third `.mockResolvedValueOnce(...)` call (the one resolving `GET /users/me` a second time). Each mock chain goes from:

```typescript
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )
```

to:

```typescript
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
```

(There are two occurrences — one per `it` block named above.)

- [ ] **Step 6: Run the full suite and the build**

Run: `cd apps/web && npx vitest run`
Expected: PASS, every test file.

Run: `cd apps/web && npx tsc -b`
Expected: exit 0, no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/AuthContext.tsx apps/web/src/lib/AuthContext.test.tsx apps/web/src/routes/RegisterPage.test.tsx
git commit -m "fix(web): skip the redundant profile re-fetch after register, reuse apiRegister's response"
```

---

## After this plan

All 9 confirmed findings from the whole-codebase review of `apps/web` are fixed on `feature/web-connect-login-fixes` (cut from `feature/web-connect-login`). Run the full suite and build one last time (`cd apps/web && npx vitest run && npx tsc -b`) before opening a PR to `develop` — this PR should supersede the never-opened PR for `feature/web-connect-login` itself, since this branch is a superset of it (all 5 original connect-login commits plus these 9 fixes).
