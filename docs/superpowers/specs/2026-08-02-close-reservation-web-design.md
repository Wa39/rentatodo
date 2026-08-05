# Close Reservation (Web) — Design

**Goal:** Wire the "Close reservation" button in `apps/web/src/routes/ReservationDetailPage.tsx` to the real `PATCH /reservations/{reservation_id}/close` endpoint, replacing the `window.alert` placeholder. This closes the last known gap flagged in `apps/api/ROADMAP.md`'s Open questions section (2026-07-23).

**Context:** `close`, `approve`, and `reject` are siblings in the reservation state machine and already share a client-side pattern for `approve`/`reject`:
- `apps/web/src/lib/api.ts` has `apiApproveReservation`/`apiRejectReservation`: `PATCH /reservations/{id}/{action}`, no request body, returns a `Reservation`.
- `apps/web/src/lib/RequestsContext.tsx` has `approveRequest`/`rejectRequest`: call the API function, then `refetch()` the full `/users/me/requests` list. `ReservationDetailPage.tsx` reads `reservation.status` via `requests.find(...)`, so this refetch is what keeps the header status text and the button's disabled state in sync.

The contract (`packages/contracts/openapi.yaml:1244`, `operationId: closeReservation`) confirms: owner-only, `returned → closed` transition, 200 → `ReservationResponse`, 409 on invalid transition or an active problem-report freeze. `ReservationDetailPage.tsx`'s existing `disabled={reservation.status !== 'returned'}` already matches this transition rule — no change needed there.

## Architecture

Mirror the `approve`/`reject` pattern exactly, at both layers:

1. **`api.ts`** — add `apiCloseReservation(token, id): Promise<Reservation>`, calling `PATCH /reservations/${id}/close` with just the `Authorization` header (same shape as `apiApproveReservation`).
2. **`RequestsContext.tsx`** — add `closeRequest(id): Promise<void>` to `RequestsContextValue`, implemented like `approveRequest`: call `apiCloseReservation`, then `await refetch(token)`. Exposed alongside `approveRequest`/`rejectRequest` in the context value.
3. **`ReservationDetailPage.tsx`** — replace the `handleClose` placeholder:
   - New local state: `closing: boolean`, `closeError: string | null`.
   - `handleClose` becomes `async`: guards on `token`/`id`, sets `closing`, calls `closeRequest(id)`.
   - On success: also re-fetch transactions (`apiGetTransactions`) so the new RELEASE transaction row appears immediately, mirroring what `handleReportSubmit` already does after a successful report. Transaction-refetch failure here reuses `transactionsError` (same as the existing pattern) — it doesn't block the close from having succeeded.
   - On failure: `setCloseError(getErrorMessage(err, ...))`.
   - `finally`: `setClosing(false)`.
   - Button: `disabled={reservation.status !== 'returned' || closing}`.
   - Error surfaced via a new `<AuthErrorBanner message={closeError} />`, matching the file's existing convention for `transactionsError`/`reportError` (not `RequestsPage.tsx`'s `window.alert` — chosen for consistency within this file, per user decision).

No changes to `apps/api` (endpoint already implemented and merged in PR #49) or to the OpenAPI contract.

## Error handling

- `409` (invalid transition / active freeze) and `403` (not owner) both surface through `getErrorMessage` → the existing `ApiError.message` from the backend, shown in the new banner. No special-casing per status/code — same as how `reportError` and `transactionsError` already handle arbitrary `ApiError`s.
- If `closeRequest` throws, `closing` still resets in `finally`, and the button re-enables (since `reservation.status` is still `'returned'`), letting the user retry.

## Testing

Extend `apps/web/src/routes/ReservationDetailPage.test.tsx` (existing `mockFetchRoutes` harness) with:
1. **Happy path** — `RESERVATION.status = 'returned'`, click "Close reservation" → `PATCH /reservations/{id}/close` returns `200` with `status: 'closed'`; assert the header re-renders with the new status and the button becomes disabled. Also stub a second `GET .../transactions` response (the post-close refetch) and assert the new transaction row appears.
2. **Failure path** — same setup, `PATCH .../close` returns `409` with an `INVALID_TRANSITION`-style error; assert the error banner shows the server's message and the button is re-enabled (not stuck disabled from a stale `closing` state).

Both follow the existing test file's `mockFetchRoutes`/`renderPage` harness — no new test infrastructure needed.

Also extend `RequestsContext`'s own test file (if one exists covering `approveRequest`/`rejectRequest`) with an equivalent `closeRequest` case, for symmetry with those two.
