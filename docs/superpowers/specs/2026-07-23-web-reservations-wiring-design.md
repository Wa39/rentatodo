# Web: wire Core Reservations to the real API

**Date:** 2026-07-23
**Scope:** `apps/web` only (read-only against `apps/api`/contract)
**Status:** Design approved, not yet planned/implemented

## Summary

`RequestsContext` currently seeds itself from `mockRequests` (`lib/mockData.ts`)
and exposes a generic `setStatus(id, status)`. The backend's Reservations
endpoints (Week 2, PR #28) have been live on `develop` since 2026-07-19. This
piece of work replaces the mock with real API calls for the subset of the
Reservations surface the owner dashboard actually needs: listing incoming
requests and approving/rejecting them.

**Explicitly out of scope** (separate specs/PRs): reservation creation and
cancel (renter actions, belong to mobile, not the owner dashboard),
checkin/checkout/close (delivery lifecycle), report-a-problem, deposit
transaction history, and earnings. `ReservationDetailPage` and
`EarningsPage` keep using mock/placeholder data for those parts after this
PR — only their base reservation lookup (via `useRequests()`) becomes real,
as a side effect of the context itself becoming real.

## Endpoints used

All already implemented and merged on `apps/api`/`develop` (Week 2, PR #28).
No contract or backend changes.

- `GET /users/me/requests` — reservations on the owner's items. Paginated
  (`{reservations, page, limit, total}`); called once with `limit=50`
  (contract max), no further paging in this PR.
- `PATCH /reservations/{reservation_id}/approve` — owner approves a
  `requested` reservation. Owner-only, enforced server-side.
- `PATCH /reservations/{reservation_id}/reject` — owner rejects a
  `requested` reservation. Owner-only, enforced server-side.

## Files touched

No new files — extends the existing `ItemsContext`/`api.ts` pattern.

- **`apps/web/src/lib/api.ts`** — add `apiListMyRequests(token)`,
  `apiApproveReservation(token, id)`, `apiRejectReservation(token, id)`, and
  a `ReservationListResponse`-shaped type matching the contract
  (`{reservations, page, limit, total}`).
- **`apps/web/src/lib/RequestsContext.tsx`** — rewritten to mirror
  `ItemsContext`: fetch-on-token-change with the same `tokenRef` staleness
  guard, `loading`/`error` state, `approveRequest(id)`/`rejectRequest(id)`
  replacing `setStatus`. Drops the `mockData` import.
- **`apps/web/src/routes/RequestsPage.tsx`** — swap
  `setStatus(id, 'approved'/'rejected')` for `approveRequest(id)`/
  `rejectRequest(id)`; add per-row in-flight state; surface `loading`/
  `error` via `AuthErrorBanner`, same as `ItemsPage`.
- **`apps/web/src/routes/DashboardPage.tsx`** — same button swap for its
  "recent pending requests" list; add `AuthErrorBanner` for the requests
  context's `error`, stacked with the existing items-context one.
  `mockEarnings.total_earnings` KPI stays mock (Earnings is a separate
  spec).
- **`apps/web/src/routes/CalendarPage.tsx`** — no data-flow change (it only
  reads `requests` from the context). Adds a branch on `useRequests()`'s
  `loading`/`error` — today it only checks `useItems()`'s, so a requests
  fetch failure currently renders an empty reservations list silently.
- **`apps/web/src/routes/ReservationDetailPage.tsx`** — untouched. Its base
  reservation lookup via `useRequests()` becomes real as a side effect;
  deposit history (`mockTransactions`) and the report form stay mock/
  placeholder.

## Data flow

### Fetch (mount / token change)

1. `RequestsProvider` mounts, `useAuth()` supplies `token`.
2. Effect fires on `token` change (mirrors `ItemsContext`): no token → reset
   `requests: []`; otherwise call `refetch(token)`.
3. `refetch` sets `loading: true`, calls `apiListMyRequests(token)` →
   `GET /users/me/requests?page=1&limit=50`, unwraps `.reservations` into
   local state. Guards against stale responses via `tokenRef`, identical to
   `ItemsContext`.
4. `total`/`page`/`limit` from the response are discarded — not exposed on
   the context, nothing consumes them yet.

### Mutate (approve / reject)

1. Caller invokes `approveRequest(id)` or `rejectRequest(id)`.
2. Context calls `PATCH /reservations/{id}/approve` (or `/reject`) with the
   bearer token.
3. On success, context calls `refetch(token)` again — chosen over trusting
   the mutation's own `ReservationResponse` body, to keep the list
   provably in sync with the server (e.g. `deposit_status` becoming
   `'held'` after approve) at the cost of one extra GET per action. Same
   trade-off `ItemsContext` already makes for its mutations.
4. On failure, the context re-throws (same convention as
   `ItemsContext.updateItem`/`deleteItem`) — the calling component decides
   how to surface it.

## Error handling & loading UX

- **Initial fetch failure:** `RequestsContext.error` set via the existing
  `getErrorMessage` helper, surfaced through `AuthErrorBanner` on
  `RequestsPage` and `DashboardPage`. `CalendarPage` gains the same check
  (previously missing).
- **Approve/reject failure:** caught at the call site, not the context —
  mirrors `ItemsPage.handleDelete`'s `window.alert(getErrorMessage(err,
  t.errors.network))` pattern. No dialog is involved here, so an alert is
  consistent with the existing delete-item precedent.
- **Per-row in-flight state:** a `pendingId`/small `Set<string>` local to
  each page, set before calling `approveRequest`/`rejectRequest`, cleared
  in `finally`. Disables only that row's buttons — prevents double-submit
  without a page-wide spinner.
- **404/409 from approve/reject** (already handled, or an invalid
  transition): surfaced through the same generic error path — the API's
  `{error: {code, message}}` body is already human-readable. No
  `error.code`-specific copy in this PR; a later refinement could add it.

## Testing

Mirror `ItemsContext.test.tsx`'s coverage for the new `RequestsContext`:

- No token → never fetches, `requests` stays `[]`
- Fetches `GET /users/me/requests` on mount when a token exists; unwraps
  `.reservations` from the paginated envelope
- `loading` is `true` while the initial fetch is in flight
- A stale in-flight response is discarded if the token changes before it
  resolves (initial fetch and mutation-triggered refetch)
- Sets `error` (doesn't throw) when the initial fetch fails
- `approveRequest` PATCHes `/approve` then refetches; same for
  `rejectRequest`/`/reject`
- A mutation attempted with no token throws `ApiError`, not a generic
  `Error`
- `useRequests()` throws when called outside a provider

Component-level, extending existing test files:

- `RequestsPage.test.tsx` / `DashboardPage.test.tsx`: clicking
  Approve/Reject calls the right context method; the button disables while
  that row's action is in flight; a failed action surfaces via alert and
  re-enables the button
- `CalendarPage.test.tsx`: a `useRequests()` error now renders
  `AuthErrorBanner` instead of silently showing an empty list

All three pages' existing tests that seed `RequestsProvider` via
`mockRequests` need updating to mock `fetch` instead — the same shift
`ItemsContext`'s tests already went through when Items was wired up.

## PR size estimate

Single PR, one vertical slice (context → 3 consumers, sequentially
dependent — the consumers can't compile against the new context interface
until it lands). One bundled PR is appropriate here rather than splitting
by consumer, matching the precedent set by `2026-07-20-web-items-crud`
(sequentially-dependent tasks within one vertical slice get one PR; only
independent sub-features get split). Estimated ~250-350 changed lines
across ~7 files (`api.ts`, `RequestsContext.tsx` + its test, 3 route files
+ their tests) — within the ~200-400 line target, under the ~10-file split
threshold.
