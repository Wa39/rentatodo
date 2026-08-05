# Web Earnings & Reservation-Detail Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/web`'s last three mock-data screens — `EarningsPage`, `DashboardPage`'s "Earned this month" KPI, and `ReservationDetailPage`'s deposit-history table + report-a-problem form — with real calls to `apps/api`'s already-live endpoints (`GET /users/me/earnings`, `GET /reservations/{id}/transactions`, `POST /reservations/{id}/report`). Closes GitHub issue #58.

**Architecture:** Mirror the existing `ItemsContext`/`RequestsContext` pattern: a new `EarningsContext` fetches on token change (with a `tokenRef` staleness guard), exposes `earnings`/`loading`/`error`, consumed by both `EarningsPage` and `DashboardPage`. `ReservationDetailPage`'s transactions fetch is reservation-scoped (not a global resource), so it stays as a local `useEffect` in the component rather than a new context, matching how `PublishItemPage` handles per-page fetches. The backend's `EarningsResponse` has no month-by-month breakdown (only `total_earnings` + `by_item[].rentals[]`), so the existing "by month" bar chart is preserved by deriving it client-side with a new pure function, `deriveByMonth`.

**Tech Stack:** React + TypeScript + Vite, Vitest + Testing Library, `fetch` against `apps/api` via `VITE_API_URL`.

## Global Constraints

- `apps/web` only — no edits to `apps/api` or `packages/contracts/openapi.yaml` (all endpoints used here already exist and are merged to `develop`, shipped in PR #49).
- Every fetch call goes through `lib/api.ts`'s `request()` helper (adds `Content-Type`, translates `{error: {code, message}}` bodies into `ApiError`).
- Follow existing test conventions exactly: `jsonResponse`/`mockFetchRoutes` helpers, `vi.spyOn(global, 'fetch')` in `beforeEach`, `vi.restoreAllMocks()` in `afterEach`, `localStorage.setItem('rentatodo_token', 'tok123')` to simulate an authenticated session.
- `ReservationDetailPage`'s "Close reservation" button stays a placeholder (`window.alert(...)`, no API call) — wiring `PATCH /reservations/{id}/close` was not part of issue #58's scope and is a separate follow-up.
- Do not edit anything under `e2e/` (Wa's territory, per team convention) — Task 8 only diagnoses and documents the Playwright impact.
- Commit convention: `type(scope): description` (Conventional Commits).

## PR Plan

**PR 1 (Tasks 1-6):** `lib/types.ts`, `lib/api.ts`, `lib/earningsDerived.ts` (new), `lib/EarningsContext.tsx` (new), `lib/i18n/en.ts`, `routes/EarningsPage.tsx`, `routes/DashboardPage.tsx`, `App.tsx` + all their tests. Branch: `feature/web-earnings-wiring`, cut from `develop`.

**PR 2 (Task 7, follow-up):** `routes/ReservationDetailPage.tsx` + its test. Independent of PR 1 — doesn't touch `EarningsContext` or any file PR 1 touches. Cut this branch from `develop` once PR 1 merges.

**Task 8** runs twice: once at the end of PR 1's branch, once at the end of PR 2's branch (each PR only breaks the fixtures for the endpoints it wires).

---

### Task 1: Earnings/Transactions/Report API client functions

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `request<T>(path, options)` (existing internal helper), `ApiError` (existing), `Transaction` (existing, from `types.ts`).
- Produces: `EarningsSummary` (new type, `{ total_earnings: number; by_item: EarningsByItem[] }`), `apiGetEarnings(token: string): Promise<EarningsSummary>`, `apiGetTransactions(token: string, reservationId: string): Promise<Transaction[]>`, `ReportProblemPayload { reason: string; photo_url: string }`, `ReportResponse { id, reservation_id, reported_by, reason, photo_url, created_at }` (all strings), `apiReportProblem(token: string, reservationId: string, data: ReportProblemPayload): Promise<ReportResponse>` — consumed by Task 3's `EarningsContext` and Task 7's `ReservationDetailPage`.

- [ ] **Step 1: Split `Earnings` into `EarningsSummary` + `by_month` in `types.ts`**

In `apps/web/src/lib/types.ts`, replace:

```ts
export interface Earnings {
  total_earnings: number
  by_item: EarningsByItem[]
  by_month: EarningsByMonth[]
}
```

with:

```ts
export interface EarningsSummary {
  total_earnings: number
  by_item: EarningsByItem[]
}

export interface Earnings extends EarningsSummary {
  by_month: EarningsByMonth[]
}
```

This is additive/backward-compatible — `mockData.ts`'s `mockEarnings: Earnings` (which already has `by_month`) still type-checks unchanged.

- [ ] **Step 2: Write the failing tests**

In `apps/web/src/lib/api.test.ts`, add `Transaction` is not needed as an import (payloads are inline). Add `apiGetEarnings`, `apiGetTransactions`, `apiReportProblem` to the existing top import line (`import { ApiError, apiApproveReservation, ... } from './api'`), then add these three `describe` blocks at the end of the file, right before the final closing brace of the outer `describe('api', ...)`:

```ts
  describe('apiGetEarnings', () => {
    it('GETs /users/me/earnings with a Bearer token and resolves with the summary', async () => {
      const payload = {
        total_earnings: 7000,
        by_item: [
          {
            item_id: 'i1',
            item_name: 'Taladro Bosch Professional',
            total: 3000,
            rentals: [{ start_date: '2026-07-01', end_date: '2026-07-03', amount: 3000 }],
          },
        ],
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiGetEarnings('tok123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/users/me/earnings',
        expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError on a 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401))

      await expect(apiGetEarnings('bad-token')).rejects.toBeInstanceOf(ApiError)
    })
  })

  describe('apiGetTransactions', () => {
    it('GETs /reservations/{id}/transactions with a Bearer token and resolves with the array', async () => {
      const payload = [
        { id: 't1', reservation_id: 'r1', type: 'hold', amount: 4500, created_at: '2026-07-10T08:00:00Z' },
      ]
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiGetTransactions('tok123', 'r1')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/reservations/r1/transactions',
        expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError with the code/message from a 403 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'FORBIDDEN', message: 'Not the owner or renter of this reservation' } }, 403),
      )

      await expect(apiGetTransactions('tok123', 'r1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Not the owner or renter of this reservation',
      })
    })
  })

  describe('apiReportProblem', () => {
    it('POSTs to /reservations/{id}/report with a Bearer token and resolves with the report', async () => {
      const payload = {
        id: 'rep1',
        reservation_id: 'r1',
        reported_by: 'u1',
        reason: 'The drill bit was broken',
        photo_url: 'https://storage.example.com/photos/broken.jpg',
        created_at: '2026-07-27T10:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 201))

      const result = await apiReportProblem('tok123', 'r1', {
        reason: 'The drill bit was broken',
        photo_url: 'https://storage.example.com/photos/broken.jpg',
      })

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/reservations/r1/report',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            reason: 'The drill bit was broken',
            photo_url: 'https://storage.example.com/photos/broken.jpg',
          }),
          headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
        }),
      )
    })

    it('throws ApiError with the code/message from a 409 response (already reported)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'INVALID_TRANSITION', message: 'Report already exists for this reservation' } }, 409),
      )

      await expect(
        apiReportProblem('tok123', 'r1', { reason: 'x', photo_url: 'https://example.com/p.jpg' }),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION', message: 'Report already exists for this reservation' })
    })
  })
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: FAIL — `apiGetEarnings`, `apiGetTransactions`, `apiReportProblem` are not exported from `./api`.

- [ ] **Step 4: Implement in `api.ts`**

Change the top import line from:

```ts
import type { Category, Item, Reservation } from './types'
```

to:

```ts
import type { Category, EarningsSummary, Item, Reservation, Transaction } from './types'
```

Then append at the end of `apps/web/src/lib/api.ts`:

```ts
export function apiGetEarnings(token: string): Promise<EarningsSummary> {
  return request('/users/me/earnings', { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
}

export function apiGetTransactions(token: string, reservationId: string): Promise<Transaction[]> {
  return request(`/reservations/${reservationId}/transactions`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
}

export interface ReportProblemPayload {
  reason: string
  photo_url: string
}

export interface ReportResponse {
  id: string
  reservation_id: string
  reported_by: string
  reason: string
  photo_url: string
  created_at: string
}

export function apiReportProblem(token: string, reservationId: string, data: ReportProblemPayload): Promise<ReportResponse> {
  return request(`/reservations/${reservationId}/report`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${token}` },
  })
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: PASS (all `describe` blocks, including the 3 new ones).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat(web): add API client functions for earnings, transactions, and report-a-problem"
```

---

### Task 2: `deriveByMonth` — client-side month bucketing for the earnings chart

**Files:**
- Create: `apps/web/src/lib/earningsDerived.ts`
- Test: `apps/web/src/lib/earningsDerived.test.ts`

**Interfaces:**
- Consumes: `EarningsByItem`, `EarningsByMonth` (existing, from `types.ts`).
- Produces: `deriveByMonth(byItem: EarningsByItem[], monthsBack?: number, now?: Date): EarningsByMonth[]` — consumed by Task 3's `EarningsContext`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/earningsDerived.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deriveByMonth } from './earningsDerived'
import type { EarningsByItem } from './types'

const NOW = new Date(2026, 6, 27) // July 27, 2026 — JS months are 0-indexed, so 6 = July

describe('deriveByMonth', () => {
  it('returns 6 buckets labeled Feb..Jul, oldest first, when given no rentals', () => {
    const result = deriveByMonth([], 6, NOW)
    expect(result.map((b) => b.month)).toEqual(['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'])
    expect(result.every((b) => b.total === 0)).toBe(true)
  })

  it('sums a rental amount into the bucket matching its end_date month', () => {
    const byItem: EarningsByItem[] = [
      {
        item_id: 'i1',
        item_name: 'Taladro',
        total: 3000,
        rentals: [{ start_date: '2026-07-01', end_date: '2026-07-03', amount: 3000 }],
      },
      {
        item_id: 'i2',
        item_name: 'Carpa',
        total: 4000,
        rentals: [{ start_date: '2026-06-10', end_date: '2026-06-12', amount: 4000 }],
      },
    ]
    const result = deriveByMonth(byItem, 6, NOW)
    expect(result.find((b) => b.month === 'Jul')!.total).toBe(3000)
    expect(result.find((b) => b.month === 'Jun')!.total).toBe(4000)
  })

  it('drops rentals older than the trailing window', () => {
    const byItem: EarningsByItem[] = [
      {
        item_id: 'i1',
        item_name: 'Taladro',
        total: 1000,
        rentals: [{ start_date: '2025-01-01', end_date: '2025-01-03', amount: 1000 }],
      },
    ]
    const result = deriveByMonth(byItem, 6, NOW)
    expect(result.reduce((sum, b) => sum + b.total, 0)).toBe(0)
  })

  it('sums multiple rentals in the same month into one bucket', () => {
    const byItem: EarningsByItem[] = [
      {
        item_id: 'i1',
        item_name: 'Taladro',
        total: 5000,
        rentals: [
          { start_date: '2026-07-01', end_date: '2026-07-03', amount: 3000 },
          { start_date: '2026-07-10', end_date: '2026-07-12', amount: 2000 },
        ],
      },
    ]
    const result = deriveByMonth(byItem, 6, NOW)
    expect(result.find((b) => b.month === 'Jul')!.total).toBe(5000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/earningsDerived.test.ts`
Expected: FAIL — cannot find module `./earningsDerived`.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/earningsDerived.ts`:

```ts
import type { EarningsByItem, EarningsByMonth } from './types'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function yearMonthIndex(dateStr: string): number {
  const [year, month] = dateStr.split('-').map(Number)
  return year * 12 + (month - 1)
}

export function deriveByMonth(byItem: EarningsByItem[], monthsBack = 6, now: Date = new Date()): EarningsByMonth[] {
  const currentIndex = now.getFullYear() * 12 + now.getMonth()
  const oldestIndex = currentIndex - (monthsBack - 1)
  const buckets: EarningsByMonth[] = []
  for (let index = oldestIndex; index <= currentIndex; index++) {
    buckets.push({ month: MONTH_LABELS[((index % 12) + 12) % 12], total: 0 })
  }

  for (const item of byItem) {
    for (const rental of item.rentals) {
      const rentalIndex = yearMonthIndex(rental.end_date)
      const offset = rentalIndex - oldestIndex
      if (offset < 0 || offset >= monthsBack) continue
      buckets[offset].total += rental.amount
    }
  }

  return buckets
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/earningsDerived.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/earningsDerived.ts apps/web/src/lib/earningsDerived.test.ts
git commit -m "feat(web): derive a trailing 6-month earnings breakdown client-side"
```

---

### Task 3: `EarningsContext`

**Files:**
- Create: `apps/web/src/lib/EarningsContext.tsx`
- Test: `apps/web/src/lib/EarningsContext.test.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `apiGetEarnings` (Task 1), `deriveByMonth` (Task 2), `getErrorMessage`/`ApiError` (existing), `useAuth` (existing), `useTranslation` (existing), `Earnings` (existing type).
- Produces: `EarningsProvider` (component), `useEarnings(): { earnings: Earnings; loading: boolean; error: string | null }` — consumed by Task 4 (`EarningsPage`), Task 5 (`DashboardPage`), Task 6 (`App.tsx`).

- [ ] **Step 1: Add i18n keys**

In `apps/web/src/lib/i18n/en.ts`, inside the existing `earnings: { ... }` block, add two keys (after `subtitle`, before `kpiTotal`):

```ts
  earnings: {
    title: 'Earnings',
    subtitle: 'Track what each item earns you.',
    loading: 'Loading your earnings…',
    loadError: "Couldn't load your earnings. Try refreshing the page.",
    kpiTotal: 'Total earned',
```

(Leave every other key in that block unchanged.)

- [ ] **Step 2: Write the failing tests**

Create `apps/web/src/lib/EarningsContext.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { EarningsProvider, useEarnings } from './EarningsContext'

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

function Probe() {
  const { earnings, loading, error } = useEarnings()
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'idle'}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="total">{earnings.total_earnings}</span>
      <span data-testid="by-item-count">{earnings.by_item.length}</span>
      <span data-testid="by-month-count">{earnings.by_month.length}</span>
    </div>
  )
}

function renderWithToken() {
  localStorage.setItem('rentatodo_token', 'tok123')
  return render(
    <AuthProvider>
      <EarningsProvider>
        <Probe />
      </EarningsProvider>
    </AuthProvider>,
  )
}

describe('EarningsContext', () => {
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
        <EarningsProvider>
          <Probe />
        </EarningsProvider>
      </AuthProvider>,
    )
    expect(screen.getByTestId('total')).toHaveTextContent('0')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches GET /users/me/earnings on mount and derives a 6-entry by_month', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/earnings': [
        () =>
          jsonResponse(
            {
              total_earnings: 7000,
              by_item: [
                {
                  item_id: 'i1',
                  item_name: 'Taladro',
                  total: 7000,
                  rentals: [{ start_date: '2026-07-01', end_date: '2026-07-03', amount: 7000 }],
                },
              ],
            },
            200,
          ),
      ],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('7000'))
    expect(screen.getByTestId('by-item-count')).toHaveTextContent('1')
    expect(screen.getByTestId('by-month-count')).toHaveTextContent('6')
  })

  it('sets an error message when the fetch fails, without throwing', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/earnings': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Earnings server exploded' } }, 500)],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Earnings server exploded'))
    expect(screen.getByTestId('total')).toHaveTextContent('0')
  })

  it('throws when useEarnings is called outside a provider', () => {
    function Bare() {
      useEarnings()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useEarnings must be used within an EarningsProvider')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/lib/EarningsContext.test.tsx`
Expected: FAIL — cannot find module `./EarningsContext`.

- [ ] **Step 4: Implement**

Create `apps/web/src/lib/EarningsContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiGetEarnings, getErrorMessage } from './api'
import { deriveByMonth } from './earningsDerived'
import { useAuth } from './AuthContext'
import { useTranslation } from './i18n'
import type { Earnings } from './types'

const EMPTY_EARNINGS: Earnings = { total_earnings: 0, by_item: [], by_month: deriveByMonth([]) }

interface EarningsContextValue {
  earnings: Earnings
  loading: boolean
  error: string | null
}

const EarningsContext = createContext<EarningsContextValue | undefined>(undefined)

export function EarningsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const t = useTranslation()
  const [earnings, setEarnings] = useState<Earnings>(EMPTY_EARNINGS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks the token that is currently "live" so a response for a token that
  // is no longer current (e.g. the user logged out while the request was in
  // flight) is discarded.
  const tokenRef = useRef(token)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    if (!token) {
      setEarnings(EMPTY_EARNINGS)
      setLoading(false)
      return
    }
    const currentToken = token
    setLoading(true)
    setError(null)
    apiGetEarnings(currentToken)
      .then((fetched) => {
        if (tokenRef.current !== currentToken) return
        setEarnings({ ...fetched, by_month: deriveByMonth(fetched.by_item) })
      })
      .catch((err) => {
        if (tokenRef.current === currentToken) setError(getErrorMessage(err, t.earnings.loadError))
      })
      .finally(() => {
        if (tokenRef.current === currentToken) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const value: EarningsContextValue = { earnings, loading, error }
  return <EarningsContext.Provider value={value}>{children}</EarningsContext.Provider>
}

export function useEarnings(): EarningsContextValue {
  const context = useContext(EarningsContext)
  if (!context) {
    throw new Error('useEarnings must be used within an EarningsProvider')
  }
  return context
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/lib/EarningsContext.test.tsx`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/EarningsContext.tsx apps/web/src/lib/EarningsContext.test.tsx apps/web/src/lib/i18n/en.ts
git commit -m "feat(web): add EarningsContext wired to GET /users/me/earnings"
```

---

### Task 4: Wire `EarningsPage` to `EarningsContext`

**Files:**
- Modify: `apps/web/src/routes/EarningsPage.tsx`
- Modify: `apps/web/src/routes/EarningsPage.test.tsx`

**Interfaces:**
- Consumes: `useEarnings` (Task 3), `useRequests` (existing), `AuthErrorBanner` (existing).

- [ ] **Step 1: Rewrite the test file first**

Replace the full contents of `apps/web/src/routes/EarningsPage.test.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCentavos } from '@/lib/format'
import { AuthProvider } from '@/lib/AuthContext'
import { EarningsProvider } from '@/lib/EarningsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { EarningsPage } from './EarningsPage'

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

const EARNINGS_PAYLOAD = {
  total_earnings: 7000,
  by_item: [
    {
      item_id: 'i1',
      item_name: 'Taladro Bosch Professional',
      total: 3000,
      rentals: [{ start_date: '2026-07-01', end_date: '2026-07-03', amount: 3000 }],
    },
    {
      item_id: 'i2',
      item_name: 'Carpa Camping 4 personas',
      total: 4000,
      rentals: [{ start_date: '2026-06-10', end_date: '2026-06-12', amount: 4000 }],
    },
  ],
}

function renderPage() {
  return render(
    <AuthProvider>
      <RequestsProvider>
        <EarningsProvider>
          <EarningsPage />
        </EarningsProvider>
      </RequestsProvider>
    </AuthProvider>,
  )
}

function mockFetchOk(earningsPayload: unknown = EARNINGS_PAYLOAD) {
  mockFetchRoutes({
    '/users/me': [() => jsonResponse(PROFILE, 200)],
    '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [], page: 1, limit: 50, total: 0 }, 200)],
    '/users/me/earnings': [() => jsonResponse(earningsPayload, 200)],
  })
}

describe('EarningsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('rentatodo_token', 'tok123')
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the total-earned KPI from the real /users/me/earnings response', async () => {
    mockFetchOk()
    renderPage()
    await waitFor(() => expect(screen.getByText(formatCentavos(EARNINGS_PAYLOAD.total_earnings))).toBeInTheDocument())
  })

  it("renders the 'This month' KPI without NaN/Infinity, and 6 bars in the by-month chart", async () => {
    mockFetchOk()
    renderPage()
    await waitFor(() => expect(screen.getAllByTestId('earnings-month-bar')).toHaveLength(6))
    const thisMonthCard = screen.getByText('This month').closest('div')!
    expect(within(thisMonthCard).getByText((content) => content.startsWith('$'))).toBeInTheDocument()
  })

  it('selects the first item by default and updates the breakdown when another item is clicked', async () => {
    const user = userEvent.setup()
    mockFetchOk()
    renderPage()
    const first = EARNINGS_PAYLOAD.by_item[0]
    const second = EARNINGS_PAYLOAD.by_item[1]

    await waitFor(() => expect(screen.getByText(first.item_name, { selector: 'h2' })).toBeInTheDocument())
    const firstPanel = screen.getByText(first.item_name, { selector: 'h2' }).closest('div')!
    expect(within(firstPanel).getByText(`${first.rentals[0].start_date} - ${first.rentals[0].end_date}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: new RegExp(second.item_name) }))
    expect(screen.getByText(second.item_name, { selector: 'h2' })).toBeInTheDocument()
  })

  it('does not render NaN/Infinity bar heights when earnings data is empty', async () => {
    mockFetchOk({ total_earnings: 0, by_item: [] })
    expect(() => renderPage()).not.toThrow()
    await waitFor(() => expect(screen.getAllByTestId('earnings-month-bar')).toHaveLength(6))
  })

  it('shows the earnings-fetch error state', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [], page: 1, limit: 50, total: 0 }, 200)],
      '/users/me/earnings': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Earnings server exploded' } }, 500)],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Earnings server exploded')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/routes/EarningsPage.test.tsx`
Expected: FAIL — `EarningsPage` still reads from `mockEarnings`, so KPIs/bars don't match the fetched payload and `data-testid="earnings-month-bar"` doesn't exist yet.

- [ ] **Step 3: Rewrite `EarningsPage.tsx`**

Replace the full contents of `apps/web/src/routes/EarningsPage.tsx`:

```tsx
import { useState } from 'react'
import { formatCentavos } from '@/lib/format'
import { useTranslation } from '@/lib/i18n'
import { useEarnings } from '@/lib/EarningsContext'
import { useRequests } from '@/lib/RequestsContext'
import { PageHeader } from '@/components/PageHeader'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'

export function EarningsPage() {
  const t = useTranslation()
  const { earnings, loading, error } = useEarnings()
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(undefined)
  const selected = earnings.by_item.find((i) => i.item_id === selectedItemId) ?? earnings.by_item[0]
  const { requests } = useRequests()
  const closedCount = requests.filter((r) => r.status === 'closed').length
  const currentMonth = earnings.by_month[earnings.by_month.length - 1] ?? { month: '', total: 0 }
  const maxMonth = Math.max(1, ...earnings.by_month.map((m) => m.total))
  const maxItem = Math.max(1, ...earnings.by_item.map((i) => i.total))

  if (loading) {
    return (
      <div>
        <PageHeader title={t.earnings.title} subtitle={t.earnings.subtitle} />
        <div className="p-four text-sm text-muted-foreground">{t.earnings.loading}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title={t.earnings.title} subtitle={t.earnings.subtitle} />
        <div className="p-four">
          <AuthErrorBanner message={error} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t.earnings.title} subtitle={t.earnings.subtitle} />
      <div className="space-y-four p-four">
        <div className="grid grid-cols-3 gap-three">
          <div className="rounded-lg border border-sidebar-border bg-sidebar p-three">
            <p className="text-xs font-medium text-sidebar-foreground/70">{t.earnings.kpiTotal}</p>
            <p className="font-display text-2xl font-semibold text-on-dark-accent">{formatCentavos(earnings.total_earnings)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-three">
            <p className="text-xs font-medium text-muted-foreground">{t.earnings.kpiThisMonth}</p>
            <p className="font-display text-2xl font-semibold text-foreground">{formatCentavos(currentMonth.total)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-three">
            <p className="text-xs font-medium text-muted-foreground">{t.earnings.kpiClosedCount}</p>
            <p className="font-display text-2xl font-semibold text-foreground">{closedCount}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-four">
          <h2 className="font-medium text-foreground">{t.earnings.chartTitle}</h2>
          <p className="mb-three text-sm text-muted-foreground">{t.earnings.chartSubtitle}</p>
          <div className="flex items-end gap-three" style={{ height: '160px' }}>
            {earnings.by_month.map((entry, index) => {
              const isCurrent = index === earnings.by_month.length - 1
              const heightPct = (entry.total / maxMonth) * 100
              return (
                <div key={`${entry.month}-${index}`} data-testid="earnings-month-bar" className="flex flex-1 flex-col items-center gap-half">
                  <div className={`w-full rounded-t-md ${isCurrent ? 'bg-primary' : 'bg-secondary'}`} style={{ height: `${heightPct}%` }} />
                  <span className="text-xs text-muted-foreground">{entry.month}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-four">
          <div>
            <h2 className="font-medium text-foreground">{t.earnings.byItemHeading}</h2>
            <p className="mb-two text-sm text-muted-foreground">{t.earnings.byItemSubtitle}</p>
            <ul className="space-y-two">
              {earnings.by_item.map((byItem) => (
                <li key={byItem.item_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(byItem.item_id)}
                    aria-pressed={selected?.item_id === byItem.item_id}
                    className={`w-full rounded-lg border p-three text-left ${
                      selected?.item_id === byItem.item_id ? 'border-primary' : 'border-border'
                    } bg-card`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{byItem.item_name}</span>
                      <span className="font-mono text-sm font-semibold text-foreground">{formatCentavos(byItem.total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.earnings.reservationCount(byItem.rentals.length)}</p>
                    <div className="mt-one h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(byItem.total / maxItem) * 100}%` }} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selected && (
            <div className="rounded-lg border border-border bg-card p-four">
              <h2 className="font-medium text-foreground">{selected.item_name}</h2>
              <p className="mb-two text-sm text-muted-foreground">{t.earnings.breakdownSubtitle}</p>
              <ul className="space-y-half text-sm text-muted-foreground">
                {selected.rentals.map((rental) => (
                  <li key={`${rental.start_date}-${rental.end_date}`} className="flex items-center justify-between">
                    <span>
                      {rental.start_date} - {rental.end_date}
                    </span>
                    <span className="font-mono">{formatCentavos(rental.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-three rounded-md bg-secondary p-two text-xs text-secondary-foreground">{t.earnings.privacyNote}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

Key behavior change from the mock version: `selectedItemId` now initializes to `undefined` (not `mockEarnings.by_item[0]?.item_id`) because `earnings.by_item` is empty until the fetch resolves — `selected` falls back to `earnings.by_item[0]` via `??` so the first item is still selected by default once data loads, without depending on `useState`'s one-time initializer running after the fetch.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/EarningsPage.test.tsx`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/EarningsPage.tsx apps/web/src/routes/EarningsPage.test.tsx
git commit -m "feat(web): wire EarningsPage to the real API"
```

---

### Task 5: Wire `DashboardPage`'s "Earned this month" KPI

**Files:**
- Modify: `apps/web/src/routes/DashboardPage.tsx`
- Modify: `apps/web/src/routes/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `useEarnings` (Task 3).

- [ ] **Step 1: Update `DashboardPage.test.tsx`**

Add the import (next to the other provider imports):

```ts
import { EarningsProvider } from '@/lib/EarningsContext'
```

Add `'/users/me/earnings': [() => jsonResponse({ total_earnings: 0, by_item: [] }, 200)],` as a new entry to **every** route map in the file — it's the same one-line insertion in five places:

1. Inside `mockFetchOk()`'s `mockFetchRoutes({...})` call — add it alongside the `/users/me` and `/users/me/items` entries.
2. Inside the `'shows at most 2 pending requests and lets you approve one'` test's `mockFetchRoutes({...})` call.
3. Inside the `"disables the acting row's Approve and Reject buttons..."` test's `vi.mocked(fetch).mockImplementation(...)` — add a branch: `if (url.endsWith('/users/me/earnings')) return Promise.resolve(jsonResponse({ total_earnings: 0, by_item: [] }, 200))` right before the final `throw new Error(...)` line.
4. Inside the `'shows the items-fetch error without hiding the rest of the dashboard'` test's `mockFetchRoutes({...})` call.
5. Inside the `'shows the requests-fetch error without hiding the rest of the dashboard'` test's `mockFetchRoutes({...})` call.
6. Inside the `'approving a request on the Dashboard is reflected on the Requests page'` test's `mockFetchRoutes({...})` call.

Wrap `EarningsProvider` around every render call, in both `renderDashboard()`:

```tsx
function renderDashboard() {
  render(
    <AuthProvider>
      <ItemsProvider>
        <RequestsProvider>
          <EarningsProvider>
            <MemoryRouter>
              <DashboardPage />
            </MemoryRouter>
          </EarningsProvider>
        </RequestsProvider>
      </ItemsProvider>
    </AuthProvider>,
  )
}
```

and the standalone `render(...)` call inside the `'approving a request on the Dashboard is reflected on the Requests page'` test:

```tsx
    render(
      <AuthProvider>
        <ItemsProvider>
          <RequestsProvider>
            <EarningsProvider>
              <MemoryRouter>
                <DashboardPage />
                <RequestsPage />
              </MemoryRouter>
            </EarningsProvider>
          </RequestsProvider>
        </ItemsProvider>
      </AuthProvider>,
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/routes/DashboardPage.test.tsx`
Expected: FAIL — `useEarnings must be used within an EarningsProvider` (thrown by `DashboardPage` once Step 3 lands) or "Unhandled fetch call" for `/users/me/earnings` if you run this before Step 3 lands — either way, confirms the harness now expects the provider/route.

- [ ] **Step 3: Wire `DashboardPage.tsx`**

Replace:

```tsx
import { mockEarnings } from '@/lib/mockData'
```

with:

```tsx
import { useEarnings } from '@/lib/EarningsContext'
```

Replace:

```tsx
  const { items, error: itemsError } = useItems()
  const { requests, error: requestsError, approveRequest, rejectRequest } = useRequests()
```

with:

```tsx
  const { items, error: itemsError } = useItems()
  const { requests, error: requestsError, approveRequest, rejectRequest } = useRequests()
  const { earnings, error: earningsError } = useEarnings()
```

Replace:

```tsx
        <AuthErrorBanner message={itemsError} />
        <AuthErrorBanner message={requestsError} />
```

with:

```tsx
        <AuthErrorBanner message={itemsError} />
        <AuthErrorBanner message={requestsError} />
        <AuthErrorBanner message={earningsError} />
```

Replace:

```tsx
            <p className="font-display text-2xl font-semibold text-on-dark-accent">{formatCentavos(mockEarnings.total_earnings)}</p>
```

with:

```tsx
            <p className="font-display text-2xl font-semibold text-on-dark-accent">{formatCentavos(earnings.total_earnings)}</p>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/DashboardPage.test.tsx`
Expected: PASS (all tests, unchanged assertions since `earnings.total_earnings` defaults to `0` with no token, same as before).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/DashboardPage.tsx apps/web/src/routes/DashboardPage.test.tsx
git commit -m "feat(web): wire DashboardPage's Earned-this-month KPI to the real API"
```

---

### Task 6: Register `EarningsProvider` in `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `EarningsProvider` (Task 3).

- [ ] **Step 1: Wire the provider**

Replace the full contents of `apps/web/src/App.tsx`:

```tsx
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { EarningsProvider } from '@/lib/EarningsContext'
import { router } from '@/routes'

function App() {
  return (
    <AuthProvider>
      <ItemsProvider>
        <RequestsProvider>
          <EarningsProvider>
            <RouterProvider router={router} />
          </EarningsProvider>
        </RequestsProvider>
      </ItemsProvider>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 2: Run the full web test suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS — `App.test.tsx`'s one test (unauthenticated redirect to `/login`) doesn't touch any provider's fetch path, so it's unaffected.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): register EarningsProvider at the app root"
```

---

### Task 7: Wire `ReservationDetailPage` to real transactions + report-a-problem

**Files:**
- Modify: `apps/web/src/routes/ReservationDetailPage.tsx`
- Modify: `apps/web/src/routes/ReservationDetailPage.test.tsx`

**Interfaces:**
- Consumes: `apiGetTransactions`, `apiReportProblem`, `getErrorMessage` (Task 1), `useAuth` (existing), `useRequests` (existing), `AuthErrorBanner` (existing), `Transaction` (existing type).

- [ ] **Step 1: Rewrite the test file first**

Replace the full contents of `apps/web/src/routes/ReservationDetailPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { ReservationDetailPage } from './ReservationDetailPage'

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
  id: '77777777-7777-4777-8777-777777777777',
  item_id: '33333333-3333-4333-8333-333333333333',
  item_name: 'Carpa Camping 4 personas',
  item_photo_url: 'https://storage.example.com/photos/carpa.jpg',
  renter_id: '88888888-8888-4888-8888-888888888888',
  renter_name: 'Camila Ríos',
  start_date: '2026-07-10',
  end_date: '2026-07-12',
  status: 'delivered',
  deposit_amount: 4500,
  deposit_status: 'held',
  created_at: '2026-07-08T09:00:00Z',
  updated_at: '2026-07-10T08:00:00Z',
}

const TRANSACTION = { id: 't1', reservation_id: RESERVATION.id, type: 'hold', amount: 4500, created_at: '2026-07-10T08:00:00Z' }

function renderPage() {
  return render(
    <AuthProvider>
      <RequestsProvider>
        <MemoryRouter initialEntries={[`/reservations/${RESERVATION.id}`]}>
          <Routes>
            <Route path="/reservations/:id" element={<ReservationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('ReservationDetailPage', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('rentatodo_token', 'tok123')
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the transaction history fetched from GET /reservations/{id}/transactions', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
    })

    renderPage()

    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())
  })

  it('shows a deposit-history error banner without crashing the page', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [
        () => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Transactions server exploded' } }, 500),
      ],
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Transactions server exploded')).toBeInTheDocument())
  })

  it('submits the report form via POST /reservations/{id}/report, then refetches transactions', async () => {
    const user = userEvent.setup()
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [
        () => jsonResponse([TRANSACTION], 200),
        () => jsonResponse([TRANSACTION, { id: 't2', reservation_id: RESERVATION.id, type: 'freeze', amount: 4500, created_at: '2026-07-27T10:00:00Z' }], 200),
      ],
      [`/reservations/${RESERVATION.id}/report`]: [
        () =>
          jsonResponse(
            {
              id: 'rep1',
              reservation_id: RESERVATION.id,
              reported_by: PROFILE.id,
              reason: 'The drill bit was broken',
              photo_url: 'https://storage.example.com/photos/broken.jpg',
              created_at: '2026-07-27T10:00:00Z',
            },
            201,
          ),
      ],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await user.type(screen.getByLabelText('What went wrong?'), 'The drill bit was broken')
    await user.type(screen.getByLabelText('Photo URL'), 'https://storage.example.com/photos/broken.jpg')
    await user.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(screen.getByText('Report submitted.')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('freeze')).toBeInTheDocument())
  })

  it('shows a report-submit error and keeps the form visible so the user can retry', async () => {
    const user = userEvent.setup()
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
      [`/reservations/${RESERVATION.id}/report`]: [
        () => jsonResponse({ error: { code: 'INVALID_TRANSITION', message: 'Report already exists for this reservation' } }, 409),
      ],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await user.type(screen.getByLabelText('What went wrong?'), 'The drill bit was broken')
    await user.type(screen.getByLabelText('Photo URL'), 'https://storage.example.com/photos/broken.jpg')
    await user.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(screen.getByText('Report already exists for this reservation')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Submit report' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/routes/ReservationDetailPage.test.tsx`
Expected: FAIL — `ReservationDetailPage` still renders from `mockTransactions` and never calls `fetch`, so `waitFor` never observes `TRANSACTION.type`.

- [ ] **Step 3: Rewrite `ReservationDetailPage.tsx`**

Replace the full contents of `apps/web/src/routes/ReservationDetailPage.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { apiGetTransactions, apiReportProblem, getErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useRequests } from '@/lib/RequestsContext'
import { formatCentavos } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import type { Transaction } from '@/lib/types'

export function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const { requests } = useRequests()
  const reservation = requests.find((r) => r.id === id)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsError, setTransactionsError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token || !id) return
    let cancelled = false
    apiGetTransactions(token, id)
      .then((fetched) => {
        if (!cancelled) setTransactions(fetched)
      })
      .catch((err) => {
        if (!cancelled) setTransactionsError(getErrorMessage(err, "Couldn't load the deposit history. Try refreshing the page."))
      })
    return () => {
      cancelled = true
    }
  }, [token, id])

  if (!reservation) {
    return <p className="text-muted-foreground">Reservation not found.</p>
  }

  function handleClose() {
    // Phase 1: no real PATCH /reservations/{id}/close call yet.
    window.alert('Reservation closed (placeholder — no API call yet).')
  }

  async function handleReportSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token || !id) return
    setSubmitting(true)
    setReportError(null)
    try {
      await apiReportProblem(token, id, { reason, photo_url: photoUrl })
      setReportSubmitted(true)
      const refreshed = await apiGetTransactions(token, id)
      setTransactions(refreshed)
    } catch (err) {
      setReportError(getErrorMessage(err, 'Something went wrong. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-four">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{reservation.item_name}</h1>
        <p className="text-muted-foreground">
          {reservation.start_date} → {reservation.end_date} · {reservation.status}
        </p>
        <Button className="mt-two" onClick={handleClose} disabled={reservation.status !== 'returned'}>
          Close reservation
        </Button>
      </div>

      <div>
        <h2 className="font-medium text-foreground">Deposit history</h2>
        <AuthErrorBanner message={transactionsError} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{tx.type}</TableCell>
                <TableCell>{formatCentavos(tx.amount)}</TableCell>
                <TableCell>{tx.created_at}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="font-medium text-foreground">Report a problem</h2>
        {reportSubmitted ? (
          <p className="text-foreground">Report submitted.</p>
        ) : (
          <form onSubmit={handleReportSubmit} className="space-y-two">
            <AuthErrorBanner message={reportError} />
            <div className="space-y-half">
              <Label htmlFor="report-reason">What went wrong?</Label>
              <Input id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
            <div className="space-y-half">
              <Label htmlFor="report-photo">Photo URL</Label>
              <Input id="report-photo" type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} required />
            </div>
            <Button type="submit" disabled={submitting}>
              Submit report
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
```

Note: `mockTransactions` (from `mockData.ts`) is no longer imported anywhere — leave `mockData.ts` and `mockData.test.ts` untouched; they're still valid fixtures, just unused by production code now.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/ReservationDetailPage.test.tsx`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Run the full web test suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS — confirms no other file imports `mockTransactions`/`mockEarnings` in a way that broke.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/ReservationDetailPage.tsx apps/web/src/routes/ReservationDetailPage.test.tsx
git commit -m "feat(web): wire ReservationDetailPage's deposit history and report-a-problem form to the real API"
```

---

### Task 8: Diagnose Playwright e2e impact (no fixture edits)

**Files:**
- Read only: `e2e/web/tests/fixtures.ts` and whichever spec files exercise `EarningsPage`/`ReservationDetailPage`.

Per prior experience wiring `RequestsContext` (PR #50/#51), any context that starts making a real fetch call breaks Playwright specs whose route mocks in `e2e/web/tests/fixtures.ts` don't yet stub that endpoint — the page hangs in a loading/error state instead of showing seeded data. `e2e/` is Wa's territory; the fix there is a fixture addition, not a web app change, so this task only diagnoses and documents — it does not edit anything under `e2e/`.

- [ ] **Step 1 (run once at the end of PR 1's branch):** Grep `e2e/web/tests/fixtures.ts` for `/users/me/earnings`. If absent, note in the PR description: "`EarningsPage`/`DashboardPage` now call `GET /users/me/earnings` for real — `e2e/web/tests/fixtures.ts` needs a route mock for it or the Playwright `earnings`/`dashboard` specs will hang. Flagging for Wa, not fixing here (outside `apps/web`)."

- [ ] **Step 2 (run once at the end of PR 2's branch):** Grep `e2e/web/tests/fixtures.ts` for `/reservations/` combined with `/transactions` and `/report`. If absent, add the equivalent note to PR 2's description for `ReservationDetailPage`'s new calls.

- [ ] **Step 3:** No commit — this task only produces PR-description text, added when opening each PR (see `superpowers:finishing-a-development-branch` / your normal PR-creation flow).

---

## Self-Review Notes

- **Spec coverage:** Issue #58's three bullets are covered — `EarningsPage` (Task 4), `DashboardPage`'s KPI (Task 5), `ReservationDetailPage`'s transactions table + report form (Task 7). The `by_month` chart gap between the mock shape and the real `EarningsResponse` contract is resolved by Task 2's `deriveByMonth`, called from Task 3's context — not left as a TODO.
- **No placeholders:** every step above has literal code, exact file paths, and exact commands to run.
- **Type consistency checked:** `EarningsSummary` (Task 1) → consumed by `EarningsContext` (Task 3) → `Earnings` (with `by_month` added) is what `EarningsPage`/`DashboardPage` read (Tasks 4-5). `apiGetTransactions`/`apiReportProblem` (Task 1) → consumed by `ReservationDetailPage` (Task 7) with matching signatures throughout.
