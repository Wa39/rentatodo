# Close Reservation (Web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the "Close reservation" button in `apps/web/src/routes/ReservationDetailPage.tsx` to the real `PATCH /reservations/{reservation_id}/close` endpoint, replacing the `window.alert` placeholder.

**Architecture:** Mirror the existing `approve`/`reject` pattern at both layers it already spans — a thin `api.ts` function, a `RequestsContext` mutation that calls it and refetches the request list, and a page-level handler that calls the context mutation. `ReservationDetailPage.tsx`'s existing `disabled={reservation.status !== 'returned'}` already encodes the contract's transition rule, so it's untouched.

**Tech Stack:** React, TypeScript, Vite, Vitest, React Testing Library (existing patterns in `apps/web`).

## Global Constraints

- No changes to `apps/api` or `packages/contracts/openapi.yaml` — the endpoint (`operationId: closeReservation`) is already implemented and merged (PR #49).
- Error display uses the existing inline `AuthErrorBanner` pattern already used twice in this file (`transactionsError`, `reportError`), not `window.alert` — per design spec `docs/superpowers/specs/2026-08-02-close-reservation-web-design.md`.
- On successful close, transactions are re-fetched (mirrors `handleReportSubmit`'s existing post-action refetch), so the new RELEASE transaction row appears without a manual page refresh.
- Branch: `feature/web-close-reservation` (already cut from `develop`; the design spec commit is already on it).

---

### Task 1: `apiCloseReservation` in `api.ts`

**Files:**
- Modify: `apps/web/src/lib/api.ts` (add function after `apiRejectReservation`, which ends at line 130)
- Test: `apps/web/src/lib/api.test.ts` (add import + `describe` block after the `apiRejectReservation` describe block, which ends at line 405)

**Interfaces:**
- Consumes: `request<T>` (`api.ts:68`), `Reservation` type (`./types`) — both already imported/defined in `api.ts`.
- Produces: `apiCloseReservation(token: string, id: string): Promise<Reservation>`, for Task 2's `RequestsContext` to call.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/lib/api.test.ts`, add `apiCloseReservation` to the import block (line 2-18), inserted alphabetically right after `apiApproveReservation`:

```ts
import {
  ApiError,
  apiApproveReservation,
  apiCloseReservation,
  apiCreateItem,
  apiDeleteItem,
  apiGetEarnings,
  apiGetMe,
  apiGetTransactions,
  apiListMyItems,
  apiListMyRequests,
  apiLogin,
  apiPresignUpload,
  apiRegister,
  apiRejectReservation,
  apiReportProblem,
  apiUpdateItem,
} from './api'
```

Then add this `describe` block right after the `apiRejectReservation` block's closing `})` (line 405), before the `apiPresignUpload` block (line 407):

```ts
  describe('apiCloseReservation', () => {
    it('PATCHes /reservations/{id}/close with a Bearer token and resolves with the updated reservation', async () => {
      const payload = {
        id: 'r1',
        item_id: 'i1',
        item_name: 'Taladro Bosch Professional',
        item_photo_url: 'https://example.com/p.jpg',
        renter_id: 'u2',
        renter_name: 'Jorge Salas',
        start_date: '2026-07-18',
        end_date: '2026-07-20',
        status: 'closed',
        deposit_amount: 2000,
        deposit_status: 'released',
        created_at: '2026-07-14T12:00:00Z',
        updated_at: '2026-07-15T09:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiCloseReservation('tok123', 'r1')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/reservations/r1/close',
        expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError with the code/message from a 409 response (active freeze)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'FREEZE_ACTIVE', message: 'Cannot close: an active problem report exists' } }, 409),
      )

      await expect(apiCloseReservation('tok123', 'r1')).rejects.toMatchObject({
        code: 'FREEZE_ACTIVE',
        message: 'Cannot close: an active problem report exists',
      })
    })
  })

```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: FAIL with `apiCloseReservation is not exported from './api'` (or a `ReferenceError`/`TypeError` to that effect).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/api.ts`, add this function directly after `apiRejectReservation` (after line 130), before `apiPresignUpload`:

```ts
export function apiCloseReservation(token: string, id: string): Promise<Reservation> {
  return request(`/reservations/${id}/close`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: all tests in the file pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat(web): add apiCloseReservation"
```

---

### Task 2: `closeRequest` in `RequestsContext`

**Files:**
- Modify: `apps/web/src/lib/RequestsContext.tsx` (add to interface, import, function, and returned value)
- Test: `apps/web/src/lib/RequestsContext.test.tsx` (add a `close` button to `Probe` + one new test)

**Interfaces:**
- Consumes: `apiCloseReservation(token, id) -> Promise<Reservation>` from Task 1; `refetch(currentToken: string): Promise<void>` (already defined in this file, `RequestsContext.tsx:34`).
- Produces: `closeRequest(id: string): Promise<void>` on `RequestsContextValue`, for Task 3's `ReservationDetailPage` to call via `useRequests()`.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/lib/RequestsContext.tsx`'s test file, first add a `close` button to the `Probe` component (after the existing `reject` button, before `logout`):

```tsx
function Probe() {
  const { requests, loading, error, approveRequest, rejectRequest, closeRequest } = useRequests()
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
      <button onClick={() => closeRequest('r1').catch(() => {})}>close</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}
```

Then add this test right after `'rejectRequest PATCHes /reject then refetches the list'` (which ends at line 235), before the `'throws an ApiError...'` test (line 237):

```tsx
  it('closeRequest PATCHes /close then refetches the list', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200),
        () => jsonResponse({ reservations: [{ ...RESERVATION, status: 'closed' }], page: 1, limit: 50, total: 1 }, 200),
      ],
      '/reservations/r1/close': [() => jsonResponse({ ...RESERVATION, status: 'closed' }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

    act(() => screen.getByText('close').click())

    await waitFor(() => expect(screen.getByText('Jorge Salas · closed')).toBeInTheDocument())
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/lib/RequestsContext.test.tsx`
Expected: FAIL — `closeRequest` is `undefined` on the context value (destructuring/property-access error), and/or `Unhandled fetch call` since the `close` button doesn't exist yet without the type update. The `Probe` component itself will also fail to compile/type-check until Step 3 adds `closeRequest` to `RequestsContextValue`.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/RequestsContext.tsx`, update the import (line 2) to add `apiCloseReservation`:

```tsx
import { apiApproveReservation, apiCloseReservation, apiListMyRequests, apiRejectReservation, ApiError, getErrorMessage } from './api'
```

Update the `RequestsContextValue` interface (lines 7-13):

```tsx
interface RequestsContextValue {
  requests: Reservation[]
  loading: boolean
  error: string | null
  approveRequest: (id: string) => Promise<void>
  rejectRequest: (id: string) => Promise<void>
  closeRequest: (id: string) => Promise<void>
}
```

Add `closeRequest` directly after `rejectRequest` (after line 74), before the `const value` line:

```tsx
  async function closeRequest(id: string) {
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Not authenticated')
    await apiCloseReservation(token, id)
    await refetch(token)
  }
```

Update the returned value (line 76):

```tsx
  const value: RequestsContextValue = { requests, loading, error, approveRequest, rejectRequest, closeRequest }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/lib/RequestsContext.test.tsx`
Expected: all tests in the file pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/RequestsContext.tsx apps/web/src/lib/RequestsContext.test.tsx
git commit -m "feat(web): add closeRequest to RequestsContext"
```

---

### Task 3: Wire the button in `ReservationDetailPage.tsx`

**Files:**
- Modify: `apps/web/src/routes/ReservationDetailPage.tsx`
- Test: `apps/web/src/routes/ReservationDetailPage.test.tsx`

**Interfaces:**
- Consumes: `closeRequest(id) -> Promise<void>` from `useRequests()` (Task 2); `apiGetTransactions(token, id) -> Promise<Transaction[]>` and `getErrorMessage(err, fallback) -> string` (already imported in this file).
- Produces: no new exports — this is the final consumer in the chain.

- [ ] **Step 1: Write the failing tests**

Add these two tests to `apps/web/src/routes/ReservationDetailPage.test.tsx`, after the last existing test (the file's `describe` block currently ends at line 191-192 with the last `it(...)`'s closing `})`) — insert before the final `})` that closes the `describe('ReservationDetailPage', ...)` block:

```tsx
  it('closes the reservation via PATCH /reservations/{id}/close, refetches requests and transactions', async () => {
    const user = userEvent.setup({ delay: null })
    const RETURNED = { ...RESERVATION, status: 'returned' }
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: [RETURNED], page: 1, limit: 50, total: 1 }, 200),
        () => jsonResponse({ reservations: [{ ...RETURNED, status: 'closed' }], page: 1, limit: 50, total: 1 }, 200),
      ],
      [`/reservations/${RESERVATION.id}/transactions`]: [
        () => jsonResponse([TRANSACTION], 200),
        () =>
          jsonResponse(
            [TRANSACTION, { id: 't2', reservation_id: RESERVATION.id, type: 'release', amount: 4500, created_at: '2026-07-28T10:00:00Z' }],
            200,
          ),
      ],
      [`/reservations/${RESERVATION.id}/close`]: [() => jsonResponse({ ...RETURNED, status: 'closed' }, 200)],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Close reservation' }))

    await waitFor(() => expect(screen.getByText(`${RESERVATION.start_date} → ${RESERVATION.end_date} · closed`)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('release')).toBeInTheDocument())
  })

  it('shows a close error and keeps the button enabled for retry when the close call fails', async () => {
    const user = userEvent.setup({ delay: null })
    const RETURNED = { ...RESERVATION, status: 'returned' }
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RETURNED], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
      [`/reservations/${RESERVATION.id}/close`]: [
        () => jsonResponse({ error: { code: 'FREEZE_ACTIVE', message: 'Cannot close: an active problem report exists' } }, 409),
      ],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Close reservation' }))

    await waitFor(() => expect(screen.getByText('Cannot close: an active problem report exists')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Close reservation' })).not.toBeDisabled()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/routes/ReservationDetailPage.test.tsx`
Expected: FAIL — clicking "Close reservation" only triggers `window.alert` (no `PATCH .../close` fetch call happens), so the `waitFor` assertions time out / the mocked routes report unused handlers.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/routes/ReservationDetailPage.tsx`, update the `useRequests()` destructure (line 17):

```tsx
  const { requests, closeRequest } = useRequests()
```

Add two new state variables directly after the existing `submitting` state (after line 25):

```tsx
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
```

Replace the `handleClose` function (lines 46-49):

```tsx
  async function handleClose() {
    if (!token || !id) return
    setClosing(true)
    setCloseError(null)
    try {
      await closeRequest(id)
    } catch (err) {
      setCloseError(getErrorMessage(err, 'Something went wrong. Please try again.'))
      setClosing(false)
      return
    }
    try {
      const refreshed = await apiGetTransactions(token, id)
      setTransactions(refreshed)
      setTransactionsError(null)
    } catch (err) {
      setTransactionsError(getErrorMessage(err, "Couldn't refresh the deposit history. Try refreshing the page."))
    } finally {
      setClosing(false)
    }
  }
```

Update the button and add the error banner (lines 77-85):

```tsx
      <div>
        <h1 className="text-lg font-semibold text-foreground">{reservation.item_name}</h1>
        <p className="text-muted-foreground">
          {reservation.start_date} → {reservation.end_date} · {reservation.status}
        </p>
        <Button className="mt-two" onClick={handleClose} disabled={reservation.status !== 'returned' || closing}>
          Close reservation
        </Button>
        <AuthErrorBanner message={closeError} />
      </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/ReservationDetailPage.test.tsx`
Expected: all tests in the file pass.

- [ ] **Step 5: Run the full web test suite to check for regressions**

Run: `cd apps/web && npx vitest run`
Expected: all pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/ReservationDetailPage.tsx apps/web/src/routes/ReservationDetailPage.test.tsx
git commit -m "feat(web): wire close-reservation button to PATCH /reservations/{id}/close"
```

---

### Task 4: Manual verification, push, open PR

**Files:** None (verification + git/PR operations only).

- [ ] **Step 1: Run the full web suite and typecheck once more from a clean state**

```bash
cd apps/web && npx vitest run && npx tsc --noEmit
```

Expected: all tests pass, no type errors.

- [ ] **Step 2: Manually verify in the browser**

With the API running (`apps/api`: `uvicorn app.main:app --reload`, DB up via `docker compose -f infra/docker-compose.yml up -d`) and the web dev server running (`cd apps/web && npm run dev`):

1. Log in as an item owner with a reservation in `returned` status (seed via `infra/seed.py`, or drive one to `returned` through the UI/API).
2. Open that reservation's detail page. Confirm "Close reservation" is enabled.
3. Click it. Confirm the status label updates to `closed`, the button becomes disabled, and a new `release` row appears in the deposit history table.
4. Separately, find or create a `returned` reservation with an active problem report (a `freeze`), click "Close reservation", and confirm the red error banner shows the server's message and the button stays enabled for retry.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feature/web-close-reservation
```

- [ ] **Step 4: Open the PR**

```bash
gh pr create --base develop --title "feat(web): wire close-reservation button to PATCH /reservations/{id}/close" --body "$(cat <<'EOF'
## Summary
- Wires the "Close reservation" button in `ReservationDetailPage.tsx` to the real `PATCH /reservations/{id}/close` endpoint, replacing the `window.alert` placeholder — closes the last gap flagged in `apps/api/ROADMAP.md`'s Open questions (2026-07-23).
- Mirrors the existing `approve`/`reject` pattern: `apiCloseReservation` in `api.ts`, `closeRequest` in `RequestsContext` (calls the API, then refetches the request list), and a page-level handler that also refetches transactions on success (mirrors `handleReportSubmit`'s existing pattern) so the new RELEASE row shows up immediately.
- Errors surface via the file's existing inline `AuthErrorBanner`, consistent with how `transactionsError`/`reportError` are already handled here.

## Test plan
- New tests: 2 in `api.test.ts` (happy path, 409), 1 in `RequestsContext.test.tsx` (PATCH + refetch), 2 in `ReservationDetailPage.test.tsx` (happy path incl. transactions refetch, 409 error + retry).
- Full `apps/web` suite green, `tsc --noEmit` clean.
- Manually verified in the browser against a running API: close succeeds from `returned`, status/button/deposit-history update live; close against an active freeze shows the error banner and re-enables the button.
EOF
)"
```

- [ ] **Step 5: Update `apps/api/ROADMAP.md`'s Open questions entry**

The design spec closes this repo-wide gap. Per `apps/api/CLAUDE.md`'s session ritual, this update belongs to whoever next works in `apps/api` — flag to Trucy (or do it yourself if you're also driving that file this session) rather than editing it silently from a web-focused branch.
