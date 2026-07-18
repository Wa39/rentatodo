# Dashboard Content Pages — Review Follow-ups (2026-07-17)

## What this is

`/code-review medium` findings on PR #25 (`feature/dashboard-content-pages` →
`feature/web-scaffold-phase1`), after the 19-task plan
(`2026-07-16-dashboard-content-pages-plan.md`) was fully implemented and merged
into that branch. PR #25 was left as-is per explicit instruction ("leave it
as-is for now") — nothing here has been fixed yet. This doc exists so the
findings aren't lost once this session ends.

**Do not start fixing these without checking in first** — several require a
design decision (see "Needs a decision" below), not just a mechanical patch.

## Confirmed bugs, ranked most severe first

1. **Publishing an item never persists it anywhere.**
   `apps/web/src/routes/PublishItemPage.tsx:36` — `handleSubmit` only calls
   `navigate('/items')`. No item is added to `mockItems` or any shared state.
   A user can fill out the whole form, click "Publish item", and the item is
   nowhere in the list afterward, with no error or confirmation.
   **Needs a decision**: this matches the original plan's Task 14 brief
   verbatim ("Phase 1: no real POST /items call yet ... just navigates
   back") — it's an intentional Phase-1 scope limitation, not an oversight.
   Fixing it means picking a state-sharing mechanism (lift state up, context,
   etc.), which is new design work, not a bug patch.

2. **`DashboardPage` and `RequestsPage` hold independent local copies of
   reservation state, so approving/rejecting on one page doesn't reflect on
   the other.**
   `apps/web/src/routes/RequestsPage.tsx:22` and
   `apps/web/src/routes/DashboardPage.tsx:12` each do
   `useState<Reservation[]>(mockRequests)` independently. Approve a pending
   request from the Dashboard's "Recent requests" widget, then go to
   `/requests` — it still shows "Pending".
   **Needs a decision**: same root cause as #1 — no shared state store yet.
   This is systemic across the app (every page reads `mockRequests`/
   `mockItems` into its own local `useState`), not unique to these two pages.

3. **`DashboardPage`'s "Active reservations" KPI disagrees with
   `RequestsPage`'s Active tab on the exact same data.**
   `apps/web/src/routes/DashboardPage.tsx:15` —
   `['approved','delivered'].includes(r.status)` excludes `'returned'`.
   `RequestsPage.tsx`'s `TAB_STATUSES.active` and `lib/availability.ts`'s
   `RESERVED_STATUSES` both include `'returned'`. `mockData.ts:95` has a
   `'returned'` reservation right now, so the Dashboard KPI is *currently*
   undercounting by 1 versus the Requests page.
   **Mechanical fix**: import `RESERVED_STATUSES` from `lib/availability.ts`
   in `DashboardPage.tsx` instead of re-declaring `['approved','delivered']`
   — removes the duplication and the drift in one move. Low risk, no design
   decision needed.

4. **Earned-this-month widget always shows an up arrow, even for a
   decrease.**
   `apps/web/src/layouts/DashboardLayout.tsx:87` hardcodes `↑` regardless of
   `deltaPct`'s sign. Not visible with the current mock data (this month >
   last month), but the code has no sign check.
   **Mechanical fix**: pick `↑`/`↓` (or `+`/`-`) based on `Math.sign(deltaPct)`.

5. **`deltaPct` can crash or produce `Infinity`/`NaN`.**
   `apps/web/src/layouts/DashboardLayout.tsx:16-17` — no guard for
   `mockEarnings.by_month` having fewer than 2 entries (crashes on
   `previousMonth.total`) or `previousMonth.total === 0` (produces
   `Infinity`/`NaN`%). Not reachable with the current fixed 6-entry mock
   array; latent only.
   **Mechanical fix**: guard both cases, render nothing or a neutral state
   instead.

6. **Earnings bar chart breaks if `by_month`/`by_item` is ever empty.**
   `apps/web/src/routes/EarningsPage.tsx:13-14` — `Math.max(...[])` is
   `-Infinity`, corrupting bar/progress-bar CSS heights and widths. Not
   reachable with the current static non-empty mock arrays; latent only.
   **Mechanical fix**: `Math.max(1, ...)` or an explicit empty-state branch.

7. **`getInitials` mishandles double/leading spaces.**
   `apps/web/src/lib/format.ts:6-10` — `"María  Vargas"` (double space) →
   `'M'` instead of `'MV'`, because `split(' ')` produces an empty-string
   element whose `[0]` is `undefined`, silently swallowed by `join('')`.
   Edge case, not triggered by any current mock name.
   **Mechanical fix**: filter out empty parts before mapping, e.g.
   `name.split(' ').filter(Boolean).map(...)`.

8. **Invalid `?item=` on `/requests/calendar` silently shows the wrong
   item's calendar.**
   `apps/web/src/routes/CalendarPage.tsx:14` —
   `mockItems.find(...) ?? mockItems[0]` has no "not found" state. Minor UX
   gap, arguably fine as-is since `mockItems` never truly empties (soft
   delete only).

## Also flagged (cleanup/efficiency, not bugs — lower priority)

From the same review pass, not yet triaged for action:
- `CATEGORIES` array duplicated verbatim in `ItemsPage.tsx` and
  `PublishItemPage.tsx` — should be one shared export.
- Status color mapping (`reserved`→destructive, `pending`→warning)
  hand-written separately in `CalendarMonth.tsx`, `ItemCard.tsx`, and
  `CalendarPage.tsx`'s legend, instead of one lookup table (the codebase
  already has this pattern in `StatusBadge.tsx`).
  `RESERVED_STATUSES`/`TAB_STATUSES`-style status bucketing duplicated in 3
  places (see finding #3 above — same root cause).
- Search/filter logic (`query.trim().toLowerCase()` + `.includes`)
  duplicated between `ItemsPage.tsx` and `RequestsPage.tsx`.
- "Dark KPI stat card" markup copy-pasted across `DashboardLayout.tsx`,
  `DashboardPage.tsx`, and `EarningsPage.tsx` instead of a shared
  `StatTile` component (the PR *did* extract `PageHeader` for a similarly
  repeated pattern, just not this one).
- Avatar-with-initials circle markup duplicated between
  `DashboardLayout.tsx` and `RequestsPage.tsx`.
- `ItemCard` recomputes `getItemDateStates`/`getAvailabilityStrip` on every
  render, uncached — cascades into `O(cards × requests)` work per keystroke
  in `ItemsPage`'s search box. Fine at current mock-data scale (4 items),
  worth a `useMemo` if data grows.
- `RequestsPage`'s tab `counts` (3 separate `.filter().length` passes) isn't
  memoized, unlike `visibleRequests` a few lines below which correctly uses
  `useMemo`.
- `CalendarMonth.tsx`'s cell-styling ternary chain and `calendar.ts`'s
  `getDateState` two-pass `.some()` scan are both minor simplification
  opportunities, not bugs.

## Source

Full findings with severity verdicts (CONFIRMED/PLAUSIBLE) were produced by
`/code-review medium` against `git diff feature/web-scaffold-phase1...HEAD`
on `feature/dashboard-content-pages` (PR #25) in this session.
