# Web Reservations Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `RequestsContext`'s mock-seeded data with real calls to `apps/api`'s already-live Reservations endpoints (`GET /users/me/requests`, `PATCH .../approve`, `PATCH .../reject`), and wire `RequestsPage`/`DashboardPage` to it.

**Architecture:** Mirror the existing `ItemsContext`/`api.ts` pattern exactly: a context that fetches on token change (with a `tokenRef` staleness guard), exposes `loading`/`error`, and refetches after each mutation. No new files, no contract changes, no backend changes.

**Tech Stack:** React + TypeScript + Vite, Vitest + Testing Library, `fetch` against `apps/api` via `VITE_API_URL`.

## Global Constraints

- `apps/web` only — no edits to `apps/api` or `packages/contracts/openapi.yaml` (all three endpoints already exist and are merged to `develop`).
- Every fetch call goes through `lib/api.ts`'s `request()` helper (adds `Content-Type`, translates `{error: {code, message}}` bodies into `ApiError`).
- `GET /users/me/requests` is fetched once, fixed at `page=1&limit=50` — no dynamic pagination in this plan.
- Mutations (`approveRequest`/`rejectRequest`) call their endpoint, then refetch the full list — never patch state locally from the mutation's own response body.
- Follow existing test conventions exactly: `jsonResponse`/`mockFetchRoutes` helpers, `vi.spyOn(global, 'fetch')` in `beforeEach`, `vi.restoreAllMocks()` in `afterEach`, `localStorage.setItem('rentatodo_token', 'tok123')` to simulate an authenticated session.
- Commit convention: `type(scope): description` (Conventional Commits).

## PR Plan

**PR 1 (Tasks 1-5):** `lib/api.ts`, `lib/i18n/en.ts`, `lib/RequestsContext.tsx`, `routes/RequestsPage.tsx`, `routes/DashboardPage.tsx` + all their tests, plus a mock-fixture-only fix to `routes/CalendarPage.test.tsx` (required to keep it passing once `RequestsContext` starts making real fetch calls — no behavior change to `CalendarPage.tsx` itself). Branch: `feature/web-reservations-wiring` (already cut from `develop` @ `7f80016`).

**PR 2 (Task 6, follow-up):** `routes/CalendarPage.tsx`'s missing error branch + its test. Independent — `CalendarPage.tsx` doesn't call `approveRequest`/`rejectRequest`, so it isn't compile-coupled to PR 1. Cut this branch from `develop` once PR 1 merges, so it starts from `RequestsContext`'s new shape without carrying PR 1's diff.

---

### Task 1: Reservation API client functions

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `request<T>(path, options)` (existing internal helper), `ApiError` (existing).
- Produces: `apiListMyRequests(token: string): Promise<ReservationListResponse>`, `apiApproveReservation(token: string, id: string): Promise<Reservation>`, `apiRejectReservation(token: string, id: string): Promise<Reservation>`, `interface ReservationListResponse { reservations: Reservation[]; page: number; limit: number; total: number }` — all consumed by Task 2's `RequestsContext`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/lib/api.test.ts` (add `apiApproveReservation`, `apiListMyRequests`, `apiRejectReservation` to the existing top import line, and add these three `describe` blocks at the end of the file, before the final closing — i.e. right after the `apiDeleteItem` block, still inside the outer `describe('api', ...)`):

```ts
  describe('apiListMyRequests', () => {
    it('GETs /users/me/requests?page=1&limit=50 with a Bearer token and resolves with the paginated envelope', async () => {
      const payload = {
        reservations: [
          {
            id: 'r1',
            item_id: 'i1',
            item_name: 'Taladro Bosch Professional',
            item_photo_url: 'https://example.com/p.jpg',
            renter_id: 'u2',
            renter_name: 'Jorge Salas',
            start_date: '2026-07-18',
            end_date: '2026-07-20',
            status: 'requested',
            deposit_amount: 2000,
            deposit_status: 'none',
            created_at: '2026-07-14T12:00:00Z',
            updated_at: '2026-07-14T12:00:00Z',
          },
        ],
        page: 1,
        limit: 50,
        total: 1,
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiListMyRequests('tok123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/users/me/requests?page=1&limit=50',
        expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError on a 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401))

      await expect(apiListMyRequests('bad-token')).rejects.toBeInstanceOf(ApiError)
    })
  })

  describe('apiApproveReservation', () => {
    it('PATCHes /reservations/{id}/approve with a Bearer token and resolves with the updated reservation', async () => {
      const payload = {
        id: 'r1',
        item_id: 'i1',
        item_name: 'Taladro Bosch Professional',
        item_photo_url: 'https://example.com/p.jpg',
        renter_id: 'u2',
        renter_name: 'Jorge Salas',
        start_date: '2026-07-18',
        end_date: '2026-07-20',
        status: 'approved',
        deposit_amount: 2000,
        deposit_status: 'held',
        created_at: '2026-07-14T12:00:00Z',
        updated_at: '2026-07-15T09:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiApproveReservation('tok123', 'r1')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/reservations/r1/approve',
        expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError with the code/message from a 409 response (invalid transition)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'INVALID_TRANSITION', message: 'Reservation is not in requested status' } }, 409),
      )

      await expect(apiApproveReservation('tok123', 'r1')).rejects.toMatchObject({
        code: 'INVALID_TRANSITION',
        message: 'Reservation is not in requested status',
      })
    })
  })

  describe('apiRejectReservation', () => {
    it('PATCHes /reservations/{id}/reject with a Bearer token and resolves with the updated reservation', async () => {
      const payload = {
        id: 'r1',
        item_id: 'i1',
        item_name: 'Taladro Bosch Professional',
        item_photo_url: 'https://example.com/p.jpg',
        renter_id: 'u2',
        renter_name: 'Jorge Salas',
        start_date: '2026-07-18',
        end_date: '2026-07-20',
        status: 'rejected',
        deposit_amount: 2000,
        deposit_status: 'none',
        created_at: '2026-07-14T12:00:00Z',
        updated_at: '2026-07-15T09:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiRejectReservation('tok123', 'r1')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/reservations/r1/reject',
        expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError with the code/message from a 403 response (not the item owner)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'FORBIDDEN', message: 'Not the item owner' } }, 403))

      await expect(apiRejectReservation('tok123', 'r1')).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'Not the item owner' })
    })
  })
```

The import line at the top of the file changes from:

```ts
import { ApiError, apiCreateItem, apiDeleteItem, apiGetMe, apiListMyItems, apiLogin, apiRegister, apiUpdateItem } from './api'
```

to:

```ts
import {
  ApiError,
  apiApproveReservation,
  apiCreateItem,
  apiDeleteItem,
  apiGetMe,
  apiListMyItems,
  apiListMyRequests,
  apiLogin,
  apiRegister,
  apiRejectReservation,
  apiUpdateItem,
} from './api'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: FAIL — `apiListMyRequests`, `apiApproveReservation`, `apiRejectReservation` are not exported from `./api`.

- [ ] **Step 3: Implement the functions**

In `apps/web/src/lib/api.ts`, change the top import from:

```ts
import type { Category, Item } from './types'
```

to:

```ts
import type { Category, Item, Reservation } from './types'
```

Add this interface next to `PresignResponse` (after it, before `async function request`):

```ts
export interface ReservationListResponse {
  reservations: Reservation[]
  page: number
  limit: number
  total: number
}
```

Add these three functions at the end of the file, after `apiPresignUpload`:

```ts
export function apiListMyRequests(token: string): Promise<ReservationListResponse> {
  return request('/users/me/requests?page=1&limit=50', { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
}

export function apiApproveReservation(token: string, id: string): Promise<Reservation> {
  return request(`/reservations/${id}/approve`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
}

export function apiRejectReservation(token: string, id: string): Promise<Reservation> {
  return request(`/reservations/${id}/reject`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: PASS — all `describe` blocks green, including the 3 new ones.

- [ ] **Step 5: Type-check and commit**

Run: `cd apps/web && npx tsc -b`
Expected: no errors.

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat(web): add reservation list/approve/reject API client functions"
```

---

### Task 2: `RequestsContext` real-data rewrite

**Files:**
- Modify: `apps/web/src/lib/i18n/en.ts`
- Modify: `apps/web/src/lib/RequestsContext.tsx`
- Test: `apps/web/src/lib/RequestsContext.test.tsx`

**Interfaces:**
- Consumes: `apiListMyRequests`, `apiApproveReservation`, `apiRejectReservation`, `ApiError`, `getErrorMessage` (Task 1), `useAuth()` → `{ token: string | null }` (existing `AuthContext`), `useTranslation()` → `t.requests.loadError` (added this task).
- Produces: `useRequests()` → `{ requests: Reservation[]; loading: boolean; error: string | null; approveRequest: (id: string) => Promise<void>; rejectRequest: (id: string) => Promise<void> }` — consumed by Task 3 (`RequestsPage`), Task 4 (`DashboardPage`), Task 5/6 (`CalendarPage`, read-only: `requests`).

- [ ] **Step 1: Add the missing i18n keys**

In `apps/web/src/lib/i18n/en.ts`, in the `requests` block, change:

```ts
  requests: {
    title: 'Requests',
    subtitle: "Everything you've been asked to rent, in one place.",
    tabPending: 'Pending',
    tabActive: 'Active',
    tabHistory: 'History',
    searchPlaceholder: 'Search by person or item…',
    reject: 'Reject',
    approve: 'Approve',
  },
```

to:

```ts
  requests: {
    title: 'Requests',
    subtitle: "Everything you've been asked to rent, in one place.",
    tabPending: 'Pending',
    tabActive: 'Active',
    tabHistory: 'History',
    searchPlaceholder: 'Search by person or item…',
    reject: 'Reject',
    approve: 'Approve',
    loading: 'Loading your requests…',
    loadError: "Couldn't load your requests. Try refreshing the page.",
  },
```

- [ ] **Step 2: Write the failing test**

Replace the full contents of `apps/web/src/lib/RequestsContext.test.tsx` with:

```tsx
import { act, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getErrorMessage } from './api'
import { AuthProvider, useAuth } from './AuthContext'
import { RequestsProvider, useRequests } from './RequestsContext'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockFetchRoutes(routes: Record<string, Array<() => Response>>) {
  const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const path = sortedPaths.find((candidate) => url.endsWith(candidate))
    const next = path ? routes[path].shift() : undefined
    if (!next) throw new Error(`Unhandled fetch call: ${url}`)
    return Promise.resolve(next())
  })
}

const PROFILE = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }

const RESERVATION = {
  id: 'r1',
  item_id: 'i1',
  item_name: 'Taladro Bosch Professional',
  item_photo_url: 'https://storage.example.com/photos/taladro.jpg',
  renter_id: 'u2',
  renter_name: 'Jorge Salas',
  start_date: '2026-07-18',
  end_date: '2026-07-20',
  status: 'requested',
  deposit_amount: 2000,
  deposit_status: 'none',
  created_at: '2026-07-14T12:00:00Z',
  updated_at: '2026-07-14T12:00:00Z',
}

function Probe() {
  const { requests, loading, error, approveRequest, rejectRequest } = useRequests()
  const { logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'idle'}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="count">{requests.length}</span>
      <ul>
        {requests.map((r) => (
          <li key={r.id}>
            {r.renter_name} · {r.status}
          </li>
        ))}
      </ul>
      <button onClick={() => approveRequest('r1').catch(() => {})}>approve</button>
      <button onClick={() => rejectRequest('r1').catch(() => {})}>reject</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

function MutationOutcomeProbe({ action }: { action: 'approve' | 'reject' }) {
  const { approveRequest, rejectRequest } = useRequests()
  const [outcome, setOutcome] = useState<'idle' | 'resolved' | 'rejected'>('idle')
  const [message, setMessage] = useState('')

  function run() {
    const promise = action === 'approve' ? approveRequest('r1') : rejectRequest('r1')
    promise
      .then(() => setOutcome('resolved'))
      .catch((err) => {
        setOutcome('rejected')
        setMessage(getErrorMessage(err, 'FALLBACK_MESSAGE'))
      })
  }

  return (
    <div>
      <span data-testid="outcome">{outcome}</span>
      <span data-testid="message">{message}</span>
      <button onClick={run}>run</button>
    </div>
  )
}

function renderWithToken() {
  localStorage.setItem('rentatodo_token', 'tok123')
  return render(
    <AuthProvider>
      <RequestsProvider>
        <Probe />
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('RequestsContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts empty and never calls fetch when there is no token', () => {
    render(
      <AuthProvider>
        <RequestsProvider>
          <Probe />
        </RequestsProvider>
      </AuthProvider>,
    )
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches GET /users/me/requests on mount and unwraps the paginated envelope', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    expect(screen.getByText('Jorge Salas · requested')).toBeInTheDocument()
  })

  it('sets loading while the initial fetch is in flight', async () => {
    let resolveRequests: (r: Response) => void = () => {}
    const requestsPromise = new Promise<Response>((resolve) => {
      resolveRequests = resolve
    })
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.includes('/users/me/requests')) return requestsPromise
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    renderWithToken()

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')
    act(() => resolveRequests(jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)))
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('idle'))
  })

  it('discards a stale in-flight response if the token changes before it resolves', async () => {
    let resolveRequests: (r: Response) => void = () => {}
    const requestsPromise = new Promise<Response>((resolve) => {
      resolveRequests = resolve
    })
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.includes('/users/me/requests')) return requestsPromise
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    renderWithToken()

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')

    act(() => screen.getByText('logout').click())
    expect(screen.getByTestId('count')).toHaveTextContent('0')

    await act(async () => {
      resolveRequests(jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('sets an error message when the initial fetch fails, without throwing', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401),
      ],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Not authenticated'))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('approveRequest PATCHes /approve then refetches the list', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200),
        () =>
          jsonResponse(
            { reservations: [{ ...RESERVATION, status: 'approved', deposit_status: 'held' }], page: 1, limit: 50, total: 1 },
            200,
          ),
      ],
      '/reservations/r1/approve': [() => jsonResponse({ ...RESERVATION, status: 'approved', deposit_status: 'held' }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

    act(() => screen.getByText('approve').click())

    await waitFor(() => expect(screen.getByText('Jorge Salas · approved')).toBeInTheDocument())
  })

  it('rejectRequest PATCHes /reject then refetches the list', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200),
        () => jsonResponse({ reservations: [{ ...RESERVATION, status: 'rejected' }], page: 1, limit: 50, total: 1 }, 200),
      ],
      '/reservations/r1/reject': [() => jsonResponse({ ...RESERVATION, status: 'rejected' }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

    act(() => screen.getByText('reject').click())

    await waitFor(() => expect(screen.getByText('Jorge Salas · rejected')).toBeInTheDocument())
  })

  it('throws an ApiError (not a generic Error) when a mutation is attempted without a token', async () => {
    render(
      <AuthProvider>
        <RequestsProvider>
          <MutationOutcomeProbe action="approve" />
        </RequestsProvider>
      </AuthProvider>,
    )

    act(() => screen.getByText('run').click())

    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('rejected'))
    expect(screen.getByTestId('message')).toHaveTextContent('Not authenticated')
  })

  it('throws when useRequests is called outside a provider', () => {
    function Bare() {
      useRequests()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useRequests must be used within a RequestsProvider')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/lib/RequestsContext.test.tsx`
Expected: FAIL — `RequestsProvider` doesn't consume `AuthContext`/`fetch` yet, `useRequests()` has no `loading`/`error`/`approveRequest`/`rejectRequest`.

- [ ] **Step 4: Rewrite the implementation**

Replace the full contents of `apps/web/src/lib/RequestsContext.tsx` with:

```tsx
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiApproveReservation, apiListMyRequests, apiRejectReservation, ApiError, getErrorMessage } from './api'
import { useAuth } from './AuthContext'
import { useTranslation } from './i18n'
import type { Reservation } from './types'

interface RequestsContextValue {
  requests: Reservation[]
  loading: boolean
  error: string | null
  approveRequest: (id: string) => Promise<void>
  rejectRequest: (id: string) => Promise<void>
}

const RequestsContext = createContext<RequestsContextValue | undefined>(undefined)

export function RequestsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const t = useTranslation()
  const [requests, setRequests] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks the token that is currently "live". Every refetch() call checks
  // this ref before applying its result, so a response for a token that is
  // no longer current (e.g. the user logged out or logged in as someone
  // else while the request was in flight) is discarded — regardless of
  // whether refetch() was triggered by the mount effect or by a mutation.
  const tokenRef = useRef(token)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  async function refetch(currentToken: string) {
    setLoading(true)
    setError(null)
    try {
      const fetched = await apiListMyRequests(currentToken)
      if (tokenRef.current !== currentToken) return
      setRequests(fetched.reservations)
    } catch (err) {
      if (tokenRef.current === currentToken) {
        setError(getErrorMessage(err, t.requests.loadError))
      }
      throw err
    } finally {
      if (tokenRef.current === currentToken) setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) {
      setRequests([])
      setLoading(false)
      return
    }
    // Fire-and-forget: the mount effect only cares about updating state
    // (handled inside refetch itself), not about the rejection that
    // refetch() now throws for callers that need to react to failure.
    refetch(token).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function approveRequest(id: string) {
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Not authenticated')
    await apiApproveReservation(token, id)
    await refetch(token)
  }

  async function rejectRequest(id: string) {
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Not authenticated')
    await apiRejectReservation(token, id)
    await refetch(token)
  }

  const value: RequestsContextValue = { requests, loading, error, approveRequest, rejectRequest }
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>
}

export function useRequests(): RequestsContextValue {
  const context = useContext(RequestsContext)
  if (!context) {
    throw new Error('useRequests must be used within a RequestsProvider')
  }
  return context
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/lib/RequestsContext.test.tsx`
Expected: PASS — all 9 tests green.

- [ ] **Step 6: Type-check and commit**

Run: `cd apps/web && npx tsc -b`
Expected: errors in `RequestsPage.tsx`/`DashboardPage.tsx`/`CalendarPage.test.tsx` are EXPECTED at this point (they still use the old `setStatus`/mock-based interface) — fixed in the next tasks. Confirm there are no errors inside `RequestsContext.tsx`/`RequestsContext.test.tsx`/`i18n/en.ts` themselves.

```bash
git add apps/web/src/lib/i18n/en.ts apps/web/src/lib/RequestsContext.tsx apps/web/src/lib/RequestsContext.test.tsx
git commit -m "feat(web): wire RequestsContext to the real Reservations API"
```

---

### Task 3: Fix `CalendarPage.test.tsx`'s mock fixtures (no behavior change)

**Files:**
- Modify: `apps/web/src/routes/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: `useRequests()` → `{ requests }` (Task 2's context; `CalendarPage.tsx` itself is untouched — it only ever read `requests`, which is still present).

`CalendarPage.tsx` is not modified in this task. Its tests wrap every render in `RequestsProvider`, which now performs a real `GET /users/me/requests` fetch — every existing test's `mockFetchRoutes` call needs that route added, and the one test that read reservation data from `mockRequests` (removed from `RequestsContext` in Task 2) needs a local fixture instead.

- [ ] **Step 1: Run the current tests to see them fail**

Run: `cd apps/web && npx vitest run src/routes/CalendarPage.test.tsx`
Expected: FAIL — most tests throw `Unhandled fetch call: .../users/me/requests?page=1&limit=50` (thrown synchronously by `mockFetchRoutes` when a route it doesn't recognize is hit).

- [ ] **Step 2: Replace the file's fixtures and route mocking**

Replace the full contents of `apps/web/src/routes/CalendarPage.test.tsx` with:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { CalendarPage } from './CalendarPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockFetchRoutes(routes: Record<string, Array<() => Response>>) {
  const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const path = sortedPaths.find((candidate) => url.endsWith(candidate))
    const next = path ? routes[path].shift() : undefined
    if (!next) throw new Error(`Unhandled fetch call: ${url}`)
    return Promise.resolve(next())
  })
}

const PROFILE = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }

const ITEMS = [
  {
    id: 'i1',
    name: 'Taladro Bosch Professional',
    description: 'd',
    category: 'tools',
    price_per_day: 1000,
    photo_url: 'https://example.com/p.jpg',
    is_active: true,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'i2',
    name: 'Carpa Camping 4 personas',
    description: 'd',
    category: 'camping',
    price_per_day: 1500,
    photo_url: 'https://example.com/p2.jpg',
    is_active: true,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
]

const RESERVATION = {
  id: 'r1',
  item_id: ITEMS[0].id,
  item_name: ITEMS[0].name,
  item_photo_url: ITEMS[0].photo_url,
  renter_id: 'u2',
  renter_name: 'Jorge Salas',
  start_date: '2026-07-18',
  end_date: '2026-07-20',
  status: 'requested',
  deposit_amount: 2000,
  deposit_status: 'none',
  created_at: '2026-07-14T12:00:00Z',
  updated_at: '2026-07-14T12:00:00Z',
}

function mockFetchOk(overrides: { items?: unknown[]; reservations?: unknown[] } = {}) {
  const items = overrides.items ?? ITEMS
  const reservations = overrides.reservations ?? [RESERVATION]
  mockFetchRoutes({
    '/users/me': [() => jsonResponse(PROFILE, 200)],
    '/users/me/items': [() => jsonResponse(items, 200)],
    '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations, page: 1, limit: 50, total: reservations.length }, 200)],
  })
}

function renderPage(initialEntry = '/requests/calendar') {
  localStorage.setItem('rentatodo_token', 'tok123')
  render(
    <AuthProvider>
      <RequestsProvider>
        <ItemsProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/requests/calendar" element={<CalendarPage />} />
            </Routes>
          </MemoryRouter>
        </ItemsProvider>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('CalendarPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to the first item when no item is preselected', async () => {
    mockFetchOk()
    renderPage()
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(ITEMS[0].id))
  })

  it('preselects the item from the ?item= query param', async () => {
    mockFetchOk()
    renderPage(`/requests/calendar?item=${ITEMS[1].id}`)
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(ITEMS[1].id))
  })

  it('switches items when a different one is picked from the dropdown', async () => {
    mockFetchOk()
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(ITEMS[0].id))
    await user.selectOptions(screen.getByRole('combobox'), ITEMS[1].id)
    expect(screen.getByRole('combobox')).toHaveValue(ITEMS[1].id)
  })

  it("lists this item's reservations below the calendar", async () => {
    mockFetchOk()
    renderPage()
    await waitFor(() => expect(screen.getByText(new RegExp(RESERVATION.renter_name))).toBeInTheDocument())
  })

  it('shows a not-found message instead of silently falling back for an invalid ?item=', async () => {
    mockFetchOk()
    renderPage('/requests/calendar?item=does-not-exist')
    await waitFor(() => expect(screen.getByText("This item doesn't exist or is no longer yours.")).toBeInTheDocument())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders each month at a fixed compact width instead of stretching full-width', async () => {
    mockFetchOk()
    renderPage()
    await waitFor(() => expect(screen.getAllByText(/2026$/)).toHaveLength(2))
    const monthHeadings = screen.getAllByText(/2026$/)
    for (const heading of monthHeadings) {
      expect(heading.parentElement?.parentElement).toHaveClass('w-[280px]')
    }
  })

  it('shows a loading message while items are still being fetched', () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.endsWith('/users/me/requests?page=1&limit=50'))
        return Promise.resolve(jsonResponse({ reservations: [], page: 1, limit: 50, total: 0 }, 200))
      if (url.endsWith('/users/me/items')) return new Promise<Response>(() => {})
      throw new Error(`Unhandled fetch call: ${url}`)
    })
    renderPage()
    expect(screen.getByText('Loading your items…')).toBeInTheDocument()
  })

  it('shows an empty-state message instead of crashing when there are no items at all', async () => {
    mockFetchOk({ items: [] })
    renderPage()
    await waitFor(() => expect(screen.getByText("You don't have any items yet. Publish one to see its calendar.")).toBeInTheDocument())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows the fetch error instead of the misleading empty-state message when items fail to load', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Server exploded' } }, 500)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [], page: 1, limit: 50, total: 0 }, 200)],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Server exploded')).toBeInTheDocument())
    expect(screen.queryByText("You don't have any items yet. Publish one to see its calendar.")).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/CalendarPage.test.tsx`
Expected: PASS — all 9 tests green, no production-code change involved.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/CalendarPage.test.tsx
git commit -m "test(web): fix CalendarPage fixtures for RequestsContext's real fetch"
```

---

### Task 4: `RequestsPage` real-data wiring

**Files:**
- Modify: `apps/web/src/routes/RequestsPage.tsx`
- Test: `apps/web/src/routes/RequestsPage.test.tsx`

**Interfaces:**
- Consumes: `useRequests()` → `{ requests, loading, error, approveRequest, rejectRequest }` (Task 2), `getErrorMessage` (Task 1, via `lib/api`), `t.requests.loading` (Task 2).
- Produces: no new exports — this is a leaf route component.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `apps/web/src/routes/RequestsPage.test.tsx` with:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { RequestsPage } from './RequestsPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockFetchRoutes(routes: Record<string, Array<() => Response>>) {
  const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const path = sortedPaths.find((candidate) => url.endsWith(candidate))
    const next = path ? routes[path].shift() : undefined
    if (!next) throw new Error(`Unhandled fetch call: ${url}`)
    return Promise.resolve(next())
  })
}

const PROFILE = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }

const REQUESTED = {
  id: 'r1',
  item_id: 'i1',
  item_name: 'Taladro Bosch Professional',
  item_photo_url: 'https://example.com/p.jpg',
  renter_id: 'u2',
  renter_name: 'Jorge Salas',
  start_date: '2026-07-18',
  end_date: '2026-07-20',
  status: 'requested',
  deposit_amount: 2000,
  deposit_status: 'none',
  created_at: '2026-07-14T12:00:00Z',
  updated_at: '2026-07-14T12:00:00Z',
}
const DELIVERED = { ...REQUESTED, id: 'r2', renter_id: 'u3', renter_name: 'Camila Ríos', status: 'delivered', deposit_status: 'held' }
const CLOSED = { ...REQUESTED, id: 'r3', renter_id: 'u4', renter_name: 'Sofía Guzmán', status: 'closed', deposit_status: 'released' }

const RESERVATIONS = [REQUESTED, DELIVERED, CLOSED]

function renderPage() {
  localStorage.setItem('rentatodo_token', 'tok123')
  render(
    <AuthProvider>
      <RequestsProvider>
        <MemoryRouter initialEntries={['/requests']}>
          <Routes>
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/reservations/:id" element={<div>Reservation detail</div>} />
          </Routes>
        </MemoryRouter>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('RequestsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the Pending tab by default with only requested reservations', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200)],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText(new RegExp(REQUESTED.renter_name))).toBeInTheDocument())
    expect(screen.queryByText(new RegExp(DELIVERED.renter_name))).not.toBeInTheDocument()
  })

  it('switches tabs and shows the right reservations for each bucket', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200)],
    })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText(new RegExp(REQUESTED.renter_name))).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /History/ }))
    expect(screen.getByText(new RegExp(CLOSED.renter_name))).toBeInTheDocument()
  })

  it('filters the visible tab by renter name', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200)],
    })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText(new RegExp(REQUESTED.renter_name))).toBeInTheDocument())
    await user.type(screen.getByRole('textbox'), REQUESTED.renter_name)
    expect(screen.getByText(new RegExp(REQUESTED.renter_name))).toBeInTheDocument()
  })

  it('approves a pending request, removing it from the Pending tab', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200),
        () =>
          jsonResponse(
            { reservations: [{ ...REQUESTED, status: 'approved', deposit_status: 'held' }, DELIVERED, CLOSED], page: 1, limit: 50, total: 3 },
            200,
          ),
      ],
      '/reservations/r1/approve': [() => jsonResponse({ ...REQUESTED, status: 'approved', deposit_status: 'held' }, 200)],
    })
    const user = userEvent.setup()
    renderPage()
    const row = await screen.findByText(new RegExp(REQUESTED.renter_name))
    await user.click(within(row.closest('li')!).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.queryByText(new RegExp(REQUESTED.renter_name))).not.toBeInTheDocument())
  })

  it('rejects a pending request, removing it from the Pending tab', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200),
        () => jsonResponse({ reservations: [{ ...REQUESTED, status: 'rejected' }, DELIVERED, CLOSED], page: 1, limit: 50, total: 3 }, 200),
      ],
      '/reservations/r1/reject': [() => jsonResponse({ ...REQUESTED, status: 'rejected' }, 200)],
    })
    const user = userEvent.setup()
    renderPage()
    const row = await screen.findByText(new RegExp(REQUESTED.renter_name))
    await user.click(within(row.closest('li')!).getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(screen.queryByText(new RegExp(REQUESTED.renter_name))).not.toBeInTheDocument())
  })

  it('links each row to its reservation detail page', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200)],
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: new RegExp(REQUESTED.renter_name) })).toHaveAttribute(
        'href',
        `/reservations/${REQUESTED.id}`,
      ),
    )
  })

  it('shows a loading message while requests are still being fetched', () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.includes('/users/me/requests')) return new Promise<Response>(() => {})
      throw new Error(`Unhandled fetch call: ${url}`)
    })
    renderPage()
    expect(screen.getByText('Loading your requests…')).toBeInTheDocument()
  })

  it('shows the fetch error via AuthErrorBanner when requests fail to load', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Server exploded' } }, 500)],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Server exploded')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/routes/RequestsPage.test.tsx`
Expected: FAIL — `RequestsPage` still reads `mockRequests`/`setStatus`, doesn't render a loading state or `AuthErrorBanner`.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `apps/web/src/routes/RequestsPage.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReservationStatus } from '@/lib/types'
import { formatCentavos, getInitials } from '@/lib/format'
import { getErrorMessage } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { useRequests } from '@/lib/RequestsContext'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Tab = 'pending' | 'active' | 'history'

const TAB_STATUSES: Record<Tab, ReservationStatus[]> = {
  pending: ['requested'],
  active: ['approved', 'delivered', 'returned'],
  history: ['closed', 'rejected', 'cancelled'],
}

export function RequestsPage() {
  const t = useTranslation()
  const { requests, loading, error, approveRequest, rejectRequest } = useRequests()
  const [tab, setTab] = useState<Tab>('pending')
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const counts: Record<Tab, number> = {
    pending: requests.filter((r) => TAB_STATUSES.pending.includes(r.status)).length,
    active: requests.filter((r) => TAB_STATUSES.active.includes(r.status)).length,
    history: requests.filter((r) => TAB_STATUSES.history.includes(r.status)).length,
  }

  const visibleRequests = useMemo(() => {
    const q = query.trim().toLowerCase()
    return requests
      .filter((r) => TAB_STATUSES[tab].includes(r.status))
      .filter((r) => !q || r.renter_name.toLowerCase().includes(q) || r.item_name.toLowerCase().includes(q))
  }, [requests, tab, query])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: t.requests.tabPending },
    { key: 'active', label: t.requests.tabActive },
    { key: 'history', label: t.requests.tabHistory },
  ]

  async function handleApprove(id: string) {
    setPendingId(id)
    try {
      await approveRequest(id)
    } catch (err) {
      window.alert(getErrorMessage(err, t.errors.network))
    } finally {
      setPendingId(null)
    }
  }

  async function handleReject(id: string) {
    setPendingId(id)
    try {
      await rejectRequest(id)
    } catch (err) {
      window.alert(getErrorMessage(err, t.errors.network))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div>
      <PageHeader title={t.requests.title} subtitle={t.requests.subtitle} />
      <div className="space-y-three p-four">
        <AuthErrorBanner message={error} />
        <div className="flex items-center justify-between gap-three">
          <div className="flex gap-two">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-three py-one text-sm font-semibold ${
                  tab === key ? 'bg-foreground text-card' : 'bg-card text-muted-foreground'
                }`}
              >
                {label} · {counts[key]}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.requests.searchPlaceholder}
            aria-label={t.requests.searchPlaceholder}
            className="max-w-xs"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t.requests.loading}</p>
        ) : (
          <ul className="space-y-two">
            {visibleRequests.map((reservation) => (
              <li key={reservation.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-three">
                <Link to={`/reservations/${reservation.id}`} className="flex items-center gap-two hover:text-primary">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                    {getInitials(reservation.renter_name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {reservation.renter_name} · {reservation.item_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reservation.start_date} — {reservation.end_date} · {formatCentavos(reservation.deposit_amount)} total
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-two">
                  <StatusBadge status={reservation.status} />
                  {reservation.status === 'requested' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === reservation.id}
                        onClick={() => handleReject(reservation.id)}
                      >
                        {t.requests.reject}
                      </Button>
                      <Button size="sm" disabled={pendingId === reservation.id} onClick={() => handleApprove(reservation.id)}>
                        {t.requests.approve}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/RequestsPage.test.tsx`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Type-check and commit**

Run: `cd apps/web && npx tsc -b`
Expected: errors remaining only in `DashboardPage.tsx` (still on the old interface — fixed next task).

```bash
git add apps/web/src/routes/RequestsPage.tsx apps/web/src/routes/RequestsPage.test.tsx
git commit -m "feat(web): wire RequestsPage to real approve/reject, with loading/error states"
```

---

### Task 5: `DashboardPage` real-data wiring

**Files:**
- Modify: `apps/web/src/routes/DashboardPage.tsx`
- Test: `apps/web/src/routes/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `useRequests()` → `{ requests, error, approveRequest, rejectRequest }` (Task 2), `useItems()` → `{ items, error }` (existing, unchanged), `getErrorMessage` (Task 1).
- Produces: no new exports — this is a leaf route component.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `apps/web/src/routes/DashboardPage.test.tsx` with:

```tsx
// apps/web/src/routes/DashboardPage.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { RESERVED_STATUSES } from '@/lib/availability'
import { DashboardPage } from './DashboardPage'
import { RequestsPage } from './RequestsPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockFetchRoutes(routes: Record<string, Array<() => Response>>) {
  const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const path = sortedPaths.find((candidate) => url.endsWith(candidate))
    const next = path ? routes[path].shift() : undefined
    if (!next) throw new Error(`Unhandled fetch call: ${url}`)
    return Promise.resolve(next())
  })
}

const PROFILE = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }

const ITEMS = [
  {
    id: 'i1',
    name: 'Taladro',
    description: 'd',
    category: 'tools',
    price_per_day: 1000,
    photo_url: 'https://example.com/p.jpg',
    is_active: true,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'i2',
    name: 'Carpa',
    description: 'd',
    category: 'camping',
    price_per_day: 1500,
    photo_url: 'https://example.com/p2.jpg',
    is_active: true,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'i3',
    name: 'Cámara vieja',
    description: 'd',
    category: 'photography',
    price_per_day: 2000,
    photo_url: 'https://example.com/p3.jpg',
    is_active: false,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
]

const REQUESTED = {
  id: 'r1',
  item_id: 'i1',
  item_name: 'Taladro',
  item_photo_url: 'https://example.com/p.jpg',
  renter_id: 'u2',
  renter_name: 'Jorge Salas',
  start_date: '2026-07-18',
  end_date: '2026-07-20',
  status: 'requested',
  deposit_amount: 2000,
  deposit_status: 'none',
  created_at: '2026-07-14T12:00:00Z',
  updated_at: '2026-07-14T12:00:00Z',
}
const DELIVERED = { ...REQUESTED, id: 'r2', renter_id: 'u3', renter_name: 'Camila Ríos', status: 'delivered', deposit_status: 'held' }
const RETURNED = { ...REQUESTED, id: 'r3', renter_id: 'u4', renter_name: 'Luz Fernández', status: 'returned', deposit_status: 'held' }
const CLOSED = { ...REQUESTED, id: 'r4', renter_id: 'u5', renter_name: 'Sofía Guzmán', status: 'closed', deposit_status: 'released' }
const REJECTED = { ...REQUESTED, id: 'r5', renter_id: 'u6', renter_name: 'Pablo Díaz', status: 'rejected', deposit_status: 'none' }

const RESERVATIONS = [REQUESTED, DELIVERED, RETURNED, CLOSED, REJECTED]

function mockFetchOk(overrides: { items?: unknown[]; reservations?: unknown[]; profile?: unknown } = {}) {
  const items = overrides.items ?? []
  const reservations = overrides.reservations ?? RESERVATIONS
  const profile = overrides.profile ?? PROFILE
  mockFetchRoutes({
    '/users/me': [() => jsonResponse(profile, 200)],
    '/users/me/items': [() => jsonResponse(items, 200)],
    '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations, page: 1, limit: 50, total: reservations.length }, 200)],
  })
}

function renderDashboard() {
  render(
    <AuthProvider>
      <ItemsProvider>
        <RequestsProvider>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </RequestsProvider>
      </ItemsProvider>
    </AuthProvider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the Active items KPI from fetched items, not a static mock array', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchOk({ items: ITEMS })
    renderDashboard()
    const pending = RESERVATIONS.filter((r) => r.status === 'requested').length

    const activeItemsCard = screen.getByText('Active items').closest('div')!
    await waitFor(() => expect(within(activeItemsCard).getByText('2')).toBeInTheDocument())

    const pendingCard = screen.getByText('Pending requests').closest('div')!
    await waitFor(() => expect(within(pendingCard).getByText(String(pending))).toBeInTheDocument())
  })

  it('shows 0 active items when there is no token yet', () => {
    renderDashboard()
    const activeItemsCard = screen.getByText('Active items').closest('div')!
    expect(within(activeItemsCard).getByText('0')).toBeInTheDocument()
  })

  it('renders the "Earned this month" KPI card with the dark-inverted treatment', () => {
    renderDashboard()
    const earnedCard = screen.getByText('Earned this month').closest('div')!
    expect(earnedCard).toHaveClass('bg-sidebar')
    expect(within(earnedCard).getByText((content) => content.startsWith('$'))).toHaveClass('text-on-dark-accent')
  })

  it('shows at most 2 pending requests and lets you approve one', async () => {
    const user = userEvent.setup()
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: RESERVATIONS.length }, 200),
        () =>
          jsonResponse(
            {
              reservations: [{ ...REQUESTED, status: 'approved', deposit_status: 'held' }, DELIVERED, RETURNED, CLOSED, REJECTED],
              page: 1,
              limit: 50,
              total: RESERVATIONS.length,
            },
            200,
          ),
      ],
      '/reservations/r1/approve': [() => jsonResponse({ ...REQUESTED, status: 'approved', deposit_status: 'held' }, 200)],
    })
    renderDashboard()
    const row = await screen.findByText(new RegExp(REQUESTED.renter_name))
    await user.click(within(row.closest('li')!).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.queryByText(new RegExp(REQUESTED.renter_name))).not.toBeInTheDocument())
  })

  it('renders the page header with the title', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it("shows the authenticated user's first name in the welcome message, not the mock user", async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchOk({ profile: { id: 'u1', name: 'Ana Torres', email: 'ana@example.com', created_at: '2026-01-01T00:00:00Z' }, reservations: [] })

    renderDashboard()

    await waitFor(() => expect(screen.getByText('Welcome back, Ana')).toBeInTheDocument())
  })

  it('shows the items-fetch error without hiding the rest of the dashboard', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Server exploded' } }, 500)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [], page: 1, limit: 50, total: 0 }, 200)],
    })
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Server exploded')).toBeInTheDocument())
    const activeItemsCard = screen.getByText('Active items').closest('div')!
    expect(within(activeItemsCard).getByText('0')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it('shows the requests-fetch error without hiding the rest of the dashboard', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Requests server exploded' } }, 500),
      ],
    })
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Requests server exploded')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it('"Active reservations" KPI matches RequestsPage\'s Active tab count, including returned', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchOk()
    renderDashboard()
    const expectedActive = RESERVATIONS.filter((r) => RESERVED_STATUSES.includes(r.status)).length
    const activeCard = screen.getByText('Active reservations').closest('div')!
    await waitFor(() => expect(within(activeCard).getByText(String(expectedActive))).toBeInTheDocument())
  })

  it('approving a request on the Dashboard is reflected on the Requests page', async () => {
    const user = userEvent.setup()
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: RESERVATIONS.length }, 200),
        () =>
          jsonResponse(
            {
              reservations: [{ ...REQUESTED, status: 'approved', deposit_status: 'held' }, DELIVERED, RETURNED, CLOSED, REJECTED],
              page: 1,
              limit: 50,
              total: RESERVATIONS.length,
            },
            200,
          ),
      ],
      '/reservations/r1/approve': [() => jsonResponse({ ...REQUESTED, status: 'approved', deposit_status: 'held' }, 200)],
    })
    render(
      <AuthProvider>
        <ItemsProvider>
          <RequestsProvider>
            <MemoryRouter>
              <DashboardPage />
              <RequestsPage />
            </MemoryRouter>
          </RequestsProvider>
        </ItemsProvider>
      </AuthProvider>,
    )
    const dashboardRow = (await screen.findAllByText(new RegExp(REQUESTED.renter_name)))[0].closest('li')!
    await user.click(within(dashboardRow).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.queryByText(new RegExp(REQUESTED.renter_name))).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^Active/ }))
    await waitFor(() => expect(screen.getByText(new RegExp(REQUESTED.renter_name))).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/routes/DashboardPage.test.tsx`
Expected: FAIL — `DashboardPage` still reads `mockRequests`/`setStatus`, no requests-error banner, no per-row disabling.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `apps/web/src/routes/DashboardPage.tsx` with:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { getErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useItems } from '@/lib/ItemsContext'
import { useTranslation } from '@/lib/i18n'
import { useRequests } from '@/lib/RequestsContext'
import { RESERVED_STATUSES } from '@/lib/availability'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'

export function DashboardPage() {
  const t = useTranslation()
  const { user } = useAuth()
  const { items, error: itemsError } = useItems()
  const { requests, error: requestsError, approveRequest, rejectRequest } = useRequests()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const activeItems = items.filter((item) => item.is_active).length
  const pendingRequests = requests.filter((r) => r.status === 'requested')
  const activeReservations = requests.filter((r) => RESERVED_STATUSES.includes(r.status)).length
  const recentPending = pendingRequests.slice(0, 2)

  async function handleApprove(id: string) {
    setPendingId(id)
    try {
      await approveRequest(id)
    } catch (err) {
      window.alert(getErrorMessage(err, t.errors.network))
    } finally {
      setPendingId(null)
    }
  }

  async function handleReject(id: string) {
    setPendingId(id)
    try {
      await rejectRequest(id)
    } catch (err) {
      window.alert(getErrorMessage(err, t.errors.network))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={t.dashboard.title}
        subtitle={t.dashboard.welcomeBack(user?.name.split(' ')[0] ?? '')}
        action={
          <Button asChild>
            <Link to="/items/publish">{t.dashboard.publishItem}</Link>
          </Button>
        }
      />
      <div className="p-four space-y-four">
        <AuthErrorBanner message={itemsError} />
        <AuthErrorBanner message={requestsError} />
        <div className="grid grid-cols-4 gap-three">
          <div className="rounded-lg border border-border bg-card p-three">
            <p className="text-xs font-medium text-muted-foreground">{t.dashboard.kpiActiveItems}</p>
            <p className="font-display text-2xl font-semibold text-foreground">{activeItems}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-three">
            <p className="text-xs font-medium text-muted-foreground">{t.dashboard.kpiPendingRequests}</p>
            <p className="font-display text-2xl font-semibold text-foreground">{pendingRequests.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-three">
            <p className="text-xs font-medium text-muted-foreground">{t.dashboard.kpiActiveReservations}</p>
            <p className="font-display text-2xl font-semibold text-foreground">{activeReservations}</p>
          </div>
          <div className="rounded-lg border border-sidebar-border bg-sidebar p-three">
            <p className="text-xs font-medium text-sidebar-foreground/70">{t.dashboard.kpiEarnedThisMonth}</p>
            <p className="font-display text-2xl font-semibold text-on-dark-accent">{formatCentavos(mockEarnings.total_earnings)}</p>
          </div>
        </div>

        <div>
          <div className="mb-two flex items-center justify-between">
            <div>
              <h2 className="font-medium text-foreground">{t.dashboard.recentRequestsTitle}</h2>
              <p className="text-sm text-muted-foreground">{t.dashboard.recentRequestsSubtitle}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/requests">{t.dashboard.viewAll}</Link>
            </Button>
          </div>
          <ul className="space-y-two">
            {recentPending.map((reservation) => (
              <li key={reservation.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-three">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t.dashboard.requestSummary(reservation.renter_name, reservation.item_name)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {reservation.start_date} — {reservation.end_date} · {formatCentavos(reservation.deposit_amount)} total
                  </p>
                </div>
                <div className="flex gap-two">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId === reservation.id}
                    onClick={() => handleReject(reservation.id)}
                  >
                    {t.dashboard.reject}
                  </Button>
                  <Button size="sm" disabled={pendingId === reservation.id} onClick={() => handleApprove(reservation.id)}>
                    {t.dashboard.approve}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/DashboardPage.test.tsx`
Expected: PASS — all 10 tests green.

- [ ] **Step 5: Full suite, type-check, and commit**

Run: `cd apps/web && npx vitest run && npx tsc -b`
Expected: PASS — the entire `apps/web` suite is green (Tasks 1-5 fully wired), no type errors anywhere.

```bash
git add apps/web/src/routes/DashboardPage.tsx apps/web/src/routes/DashboardPage.test.tsx
git commit -m "feat(web): wire DashboardPage to real approve/reject and requests error state"
```

**This is the end of PR 1.** Push `feature/web-reservations-wiring` and open a PR against `develop` — open it for team review, do not merge it yourself.

---

### Task 6 (PR 2, follow-up): `CalendarPage`'s missing requests-error branch

**Files:**
- Modify: `apps/web/src/routes/CalendarPage.tsx`
- Modify: `apps/web/src/routes/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: `useRequests()` → `{ requests, error }` (Task 2 — `error` is newly read here; `requests` was already read).

**Setup note:** this task starts from a fresh branch cut from `develop` once PR 1 has merged (so `RequestsContext`'s real-data shape is already present via `develop`, without carrying PR 1's own diff). Name it e.g. `feature/web-calendar-requests-error`.

- [ ] **Step 1: Write the failing test**

Append this test to the `describe('CalendarPage', ...)` block in `apps/web/src/routes/CalendarPage.test.tsx` (after the last existing test, before the closing `})`):

```tsx
  it('shows the requests fetch error instead of silently rendering an empty reservations list', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse(ITEMS, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Requests server exploded' } }, 500),
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Requests server exploded')).toBeInTheDocument())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `cd apps/web && npx vitest run src/routes/CalendarPage.test.tsx`
Expected: FAIL — the new test times out waiting for "Requests server exploded"; `CalendarPage` currently ignores `useRequests()`'s `error` and instead falls through to rendering the calendar with an empty reservation list.

- [ ] **Step 3: Add the error branch**

In `apps/web/src/routes/CalendarPage.tsx`, change:

```tsx
  const { items, loading, error } = useItems()
  const { requests } = useRequests()
```

to:

```tsx
  const { items, loading, error } = useItems()
  const { requests, error: requestsError } = useRequests()
```

Then, immediately after the existing `if (error) { ... }` block (the one rendering `<AuthErrorBanner message={error} />`) and before `if (items.length === 0) { ... }`, add:

```tsx
  if (requestsError) {
    return (
      <div>
        <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />
        <div className="p-four">
          <AuthErrorBanner message={requestsError} />
        </div>
      </div>
    )
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/CalendarPage.test.tsx`
Expected: PASS — all 10 tests green (9 existing + the new one).

- [ ] **Step 5: Type-check and commit**

Run: `cd apps/web && npx tsc -b`
Expected: no errors.

```bash
git add apps/web/src/routes/CalendarPage.tsx apps/web/src/routes/CalendarPage.test.tsx
git commit -m "fix(web): show requests-fetch error on CalendarPage instead of an empty list"
```

Push this branch and open a PR against `develop`.

---

## Self-Review

**Spec coverage:**
- `apiListMyRequests`/`apiApproveReservation`/`apiRejectReservation` — Task 1. ✓
- `RequestsContext` real-data rewrite (loading/error/approveRequest/rejectRequest, tokenRef guard, refetch-after-mutate) — Task 2. ✓
- `RequestsPage` wiring (loading/error UI, per-row in-flight disable, approve/reject alerts) — Task 4. ✓
- `DashboardPage` wiring (same pattern, stacked error banners) — Task 5. ✓
- `CalendarPage`'s missing error branch — Task 6 (split into PR 2 per the file-count discussion). ✓
- `ReservationDetailPage` — explicitly out of scope per the spec; not touched by any task. ✓
- Testing coverage listed in the spec (stale-response discarding, no-token mutation throwing `ApiError`, provider-less `useRequests()` throw, per-page loading/error) — covered in Tasks 2, 4, 5, 6. ✓
- PR-size target — addressed by the Task 3/Task 6 split (PR 1 lands at 9 files: `api.ts`+test, `en.ts`, `RequestsContext.tsx`+test, `RequestsPage.tsx`+test, `DashboardPage.tsx`+test, plus the test-only `CalendarPage.test.tsx` fix = 10 files touched, under the file-count flag once `CalendarPage.tsx`'s own change is deferred to PR 2). ✓

**Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code.

**Type consistency:** `Reservation`/`ReservationListResponse` shape is identical across `api.ts`, `RequestsContext.tsx`, and every test fixture (`id, item_id, item_name, item_photo_url, renter_id, renter_name, start_date, end_date, status, deposit_amount, deposit_status, created_at, updated_at`). `approveRequest`/`rejectRequest` names are consistent from Task 2's production of the interface through Tasks 4/5's consumption of it — no drift (e.g. no `approve()` vs `approveRequest()` mismatch).
