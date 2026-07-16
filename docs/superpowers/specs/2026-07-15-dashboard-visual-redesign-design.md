# Dashboard Visual Redesign — Design

## Context

Silverk (the owner-dashboard developer) produced a real mockup — `RentaTodo_Dashboard_Preview.pdf` (a 6-screen preview: Resumen, Mis artículos, Publicar, Solicitudes, Calendario, Ganancias) plus the underlying `dashboard.html` it was rendered from — proposing a fuller visual and content direction for `apps/web` than the Phase 1 scaffold shipped with (`docs/superpowers/plans/2026-07-15-web-app-scaffold-phase1.md`, all 18 tasks merged). This document specs the redesign work: adopting the mockup's visual system (colors, fonts, sidebar layout) and folding in the content it adds (dashboard KPIs, a live-preview publish page, a real interactive calendar, per-item renter history) onto the **existing 8 routes** — this is a restyle-and-extend of what exists, not a rebuild.

Reference documents (read for context, not modified):
- `C:\Users\josma\Downloads\dashboard.html` — the mockup's full HTML/CSS source
- `C:\Users\josma\Downloads\RentaTodo_Dashboard_Preview.pdf` — Silverk's own 6-screen preview deck (same design, presentation form)
- `C:\Users\josma\Downloads\Plan_Proyecto_RentaTodo (1).pdf` — the team's 4-week project plan (roles, non-negotiable scope, gitflow rules) — confirms deposit hold/release and the report-problem mechanism are "intocable" (core, non-negotiable) requirements, which is why the reservation-detail page's functionality is preserved even though the mockup's 6-screen deck doesn't depict it as a distinct screen.

Scope constraint (unchanged from the original scaffold): this work only touches `apps/web` and `packages/design-tokens`. Never `apps/api`, `apps/mobile`, `.github/`, `e2e/`, `infra/`, or `packages/contracts/openapi.yaml`.

Phase 1 rules still apply: no real network calls. All data continues to come from `apps/web/src/lib/mockData.ts`. This redesign only changes how existing pages *look*, plus the *specific* new interactions called out below (calendar month navigation, publish-page live preview) — it does not add real API integration; that remains Phase 2, separately blocked on backend work.

**Explicit decision, made with the human:** the mockup's palette (forest green, dark sidebar, amber, blue) replaces `packages/design-tokens`' current palette (teal/ink, originally sourced from `apps/mobile/src/constants/brand.ts`). This is a deliberate, one-way divergence from `apps/mobile`'s current colors — mobile has not been updated to match, and this document does not touch it. `packages/design-tokens/README.md` must be updated to say plainly that the shared-token promise between web and mobile is currently broken, so whoever next touches `apps/mobile`'s theming knows to either update mobile to match or treat the two apps' visual identities as intentionally diverged for now.

## Global Constraints

- Scope: `apps/web` + `packages/design-tokens` only.
- Phase 1 only: no real network calls anywhere. All pages read from `apps/web/src/lib/mockData.ts`.
- Money: integer USD centavos everywhere, `formatCentavos` for display — unchanged from the existing rule.
- `CategoryEnum`, `ReservationStatusEnum`, `deposit_status`, `TransactionTypeEnum` — unchanged, still the exact contract values.
- The 8 existing routes do not change: `/login`, `/register`, `/dashboard`, `/items`, `/items/:id`, `/requests`, `/reservations/:id`, `/earnings`, plus one new route: `/items/publish`.
- Design tokens (colors below) are the new source of truth for `apps/web`'s visual identity. Do not reference or copy `apps/mobile`'s current colors — that package is intentionally out of sync now.
- Fonts loaded via Google Fonts CDN (`<link>` tags in `apps/web/index.html`), not self-hosted — matches the mockup exactly, standard practice, not a "hardcoded URL" in the CLAUDE.md sense (that rule targets API endpoints/IPs/credentials, not public font CDNs).
- The item-detail calendar's month-navigation buttons are real, working UI (client-side state), but the booked/pending/available data they display remains illustrative mock data — no real date-overlap computation. Per the human's explicit instruction, full calendar functionality is Week 3 project scope, not now.
- Every visual change must preserve existing test coverage — no page loses assertions, only gains/updates ones for new markup or new behavior (calendar nav, publish-page preview, KPI cards).

## Visual System

### Colors

Source values (from `dashboard.html`'s `:root`), converted to HSL for the shadcn CSS-variable system already wired in `apps/web/src/index.css` (Task 6 of the original scaffold):

| Token | Hex | HSL |
|---|---|---|
| `sidebar` | `#16231d` | `152 23% 11%` |
| `sidebar-hover` | `#1f3129` | `153 23% 16%` |
| `bg` | `#f4f6f4` | `120 10% 96%` |
| `card` | `#ffffff` | `0 0% 100%` |
| `border` | `#e2e7e3` | `132 9% 90%` |
| `ink` | `#16221d` | `155 21% 11%` |
| `ink-soft` | `#5c6b64` | `152 8% 39%` |
| `ink-faint` | `#94a39c` | `152 8% 61%` |
| `forest` | `#2f6f4e` | `149 41% 31%` |
| `forest-dark` | `#234f39` | `150 39% 22%` |
| `forest-tint` | `#e7f1ea` | `138 26% 93%` |
| `amber` | `#d98c2b` | `33 70% 51%` |
| `amber-tint` | `#fbeed9` | `37 81% 92%` |
| `amber-ink` (text-on-amber, e.g. avatar/badge text) | `#241505` | `31 76% 8%` |
| `red` | `#c0442e` | `9 61% 47%` |
| `red-tint` | `#f8e4df` | `12 64% 92%` |
| `blue` | `#3563a8` | `216 52% 43%` |
| `blue-tint` | `#e4ebf6` | `217 50% 93%` |
| `sidebar-foreground` (base sidebar text, `#cfd9d2`) | `#cfd9d2` | `138 12% 83%` |
| `sidebar-border` (sidebar-footer divider, `#263a30`) | `#263a30` | `150 21% 19%` |

`packages/design-tokens/tokens.ts`'s `colors` export is replaced with these values (same flat-object shape as today, new names/values). Update `packages/design-tokens/README.md`'s note about `apps/mobile` to state the divergence explicitly (see Context above).

`apps/web/src/index.css`'s `:root` CSS variables (shadcn's semantic slots) map as:

```
--background: 120 10% 96%;         /* bg */
--foreground: 155 21% 11%;         /* ink */
--card: 0 0% 100%;
--card-foreground: 155 21% 11%;    /* ink */
--popover: 0 0% 100%;
--popover-foreground: 155 21% 11%; /* ink */
--primary: 149 41% 31%;            /* forest */
--primary-foreground: 0 0% 100%;
--secondary: 138 26% 93%;          /* forest-tint */
--secondary-foreground: 150 39% 22%; /* forest-dark */
--muted: 132 9% 90%;               /* border */
--muted-foreground: 152 8% 39%;    /* ink-soft */
--accent: 138 26% 93%;             /* forest-tint */
--accent-foreground: 150 39% 22%;  /* forest-dark */
--destructive: 9 61% 47%;          /* red */
--destructive-foreground: 0 0% 100%;
--border: 132 9% 90%;
--input: 132 9% 90%;
--ring: 149 41% 31%;               /* forest */
--radius: 0.625rem;                /* 10px, was 0.5rem */
```

**Correction after re-reading the actual current files** (the original draft of this section assumed new custom `--sidebar-bg`/`--sidebar-hover` variable names without checking — wrong): `apps/web/tailwind.config.ts` already has shadcn's full `sidebar.*` color block wired (`sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`, all pointing at `hsl(var(--sidebar-*))`), generated by Task 6's shadcn init but never populated in `:root` (`apps/web/src/index.css`'s `:root` block has no `--sidebar*` entries at all today — only `.dark` does, which is why `bg-sidebar` and friends are currently dead/unstyled classes in light mode). This redesign populates those **already-reserved** slots instead of inventing new names:

```
--sidebar: 152 23% 11%;                    /* sidebar bg #16231d */
--sidebar-foreground: 138 12% 83%;         /* base sidebar text #cfd9d2 */
--sidebar-primary: 149 41% 31%;            /* active nav item bg = forest */
--sidebar-primary-foreground: 0 0% 100%;   /* white text on active item */
--sidebar-accent: 153 23% 16%;             /* hover bg #1f3129 */
--sidebar-accent-foreground: 0 0% 100%;    /* white text on hover */
--sidebar-border: 150 21% 19%;             /* sidebar-footer divider #263a30 */
--sidebar-ring: 149 41% 31%;               /* same as --ring */
```

Separately, `warning`/`info` genuinely are new — shadcn's default palette has no pending/active-state color slot, so these are real additions to `apps/web/tailwind.config.ts`'s `theme.extend.colors` (not present today):

```
--warning: 33 70% 51%;             /* amber */
--warning-foreground: 31 76% 8%;   /* amber-ink */
--warning-tint: 37 81% 92%;        /* amber-tint */
--info: 216 52% 43%;               /* blue */
--info-foreground: 0 0% 100%;
--info-tint: 217 50% 93%;          /* blue-tint */
```

`apps/web/tailwind.config.ts`'s `theme.extend.colors` gains only `warning`/`warning-foreground`/`warning-tint`/`info`/`info-foreground`/`info-tint` as new keys (`hsl(var(--x))`-wrapped, same pattern as the existing `primary`/`destructive`/etc.) — the `sidebar` key already exists in the file and only needs its CSS variables defined, not new Tailwind config. Lighter sidebar text shades used ad hoc in the mockup (`#b7c4bd` nav-item text, `#8a988f` footer-role text, `#6b7a72` section-label text) are approximated via Tailwind opacity modifiers on `sidebar-foreground` (e.g. `text-sidebar-foreground/80`) rather than more named tokens — YAGNI, avoids one-off token proliferation for text-opacity variance.

### Fonts

Add to `apps/web/index.html`'s `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```
`apps/web/tailwind.config.ts`'s `theme.extend.fontFamily` gains `display: ['"Space Grotesk"', 'sans-serif']` (headings), `sans: ['Inter', 'sans-serif']` (body, explicit rather than relying on Tailwind's default stack), `mono: ['"JetBrains Mono"', 'monospace']` (dates, prices, ids — used via `font-mono` utility, replacing ad hoc `font-family` usage).

### Radius

`--radius` becomes `0.625rem` (10px), up from `0.5rem`. shadcn's generated components already reference `var(--radius)` via `rounded-lg`/`rounded-md`/`rounded-sm` in `tailwind.config.ts`'s `borderRadius` extension (Task 4) — no component code changes needed, just the variable value.

## Layout & Navigation

`apps/web/src/layouts/DashboardLayout.tsx` is rewritten from a top-nav-bar to a fixed left sidebar:

- **Brand mark**: "R" logo block + "RentaTodo" wordmark, top of sidebar.
- **Nav groups** (matches the mockup's section labels), each item a `<Link>` to its existing route:
  - **Panel**: Resumen → `/dashboard`
  - **Inventario**: Mis artículos → `/items`; Publicar artículo → `/items/publish` (new route)
  - **Actividad**: Solicitudes → `/requests` (shows a pending-count badge, computed as `mockRequests.filter(r => r.status === 'requested').length`)
  - **Finanzas**: Ganancias → `/earnings`
- **Footer**: avatar (initials derived from `mockUser.name`) + name + "Dueña" role label, plus the existing Log out button (unchanged behavior, `useAuth().logout`).
- Active-route highlighting via React Router's `useLocation`/`NavLink`-style active-class matching (or manual `location.pathname === to` check) — the mockup's JS toggles an `.active` class by hand; we get the equivalent for free from React Router.
- `<Outlet />` renders in the main content area, unchanged structurally from today.

No "Calendario" top-level nav item (per the human's explicit decision) — the calendar lives at `/items/:id`, reached via each item card's "Calendario" button on `/items` (see below), exactly like today's existing "click an item to see its detail" pattern, just restyled and content-upgraded.

`/login` and `/register` are restyled with the new palette/fonts in the same centered-card layout that exists today — no structural change, no new fields, just new colors/fonts/radius.

## Page-by-Page Changes

### Dashboard (`/dashboard`)

Add, above the existing profile summary (or replacing it — the KPI section becomes the primary content):
- 4 stat cards: "Artículos activos" (`mockItems.filter(i => i.is_active).length`), "Solicitudes pendientes" (`mockRequests.filter(r => r.status === 'requested').length`), "Reservas activas" (`mockRequests.filter(r => ['approved','delivered'].includes(r.status)).length`), "Ganado este mes" (`formatCentavos(mockEarnings.total_earnings)` — Phase 1 has no real month-filtering, so this reuses the existing total; a comment notes real month-scoping is Phase 2/backend work).
- "Solicitudes recientes" section: the top 2 `status === 'requested'` entries from `mockRequests`, each with inline Approve/Reject (reusing the same local-state-update pattern as `RequestsPage`), and a "Ver todas" button linking to `/requests`.

All derived from existing mock arrays — no new fixture shape required.

### My items (`/items`)

Each item card gains a 14-day availability strip: 14 small blocks, colored gray (available)/amber (pending)/red (booked). Since there's no real per-day availability array in the contract or mock data, this is computed by checking each of the next 14 calendar days (from `new Date()`) against that item's `unavailable_dates` (via `mockItemDetail(item.id)`) — a day within any `unavailable_dates` range paints red; Phase 1 has no concept of a separate "pending" (not-yet-approved) date distinct from "booked," so pending coloring is deferred (render only available/booked for now, not a fabricated third state) — this is a deliberate simplification flagged here rather than inventing pending-date mock semantics that don't exist elsewhere in the codebase.

Existing Edit/Delete actions, publish Dialog trigger, and Inactive badge logic are unchanged in behavior — only visual restyle plus one new "Calendario" button per card (in addition to the existing item-name link) that also navigates to `/items/:id`, matching the mockup's explicit 3-button row (Editar/Calendario/Eliminar). The item-name-as-link and the new "Calendario" button are two paths to the same destination — acceptable duplication since it matches the mockup's actual layout (both a clickable title and an explicit calendar button exist there).

### Publish item (`/items/publish` — new route)

Move the existing publish form out of `ItemsPage`'s Dialog into its own page component, `PublishItemPage.tsx`, registered at `/items/publish` (protected route, alongside the other `RequireAuth`-wrapped pages). Same fields, same category enum, same centavo conversion logic, same "Cancel" behavior (navigates back to `/items`) — this is a container change, not a logic change. `ItemsPage.tsx` currently renders each item's card inline inside a `<ul>` (no separate component) — this work extracts that markup into a new `apps/web/src/components/ItemCard.tsx`, used by both `ItemsPage` (real items, with Edit/Delete/Calendario actions) and the new `PublishItemPage`'s live preview panel (a read-only rendering fed the in-progress form values, no action buttons). This is the one structural refactor this redesign requires — everywhere else, existing components are restyled in place, not re-decomposed.

The Edit flow (pre-filled dialog, per-item) stays as an in-page Dialog on `/items` — only the *create* flow moves to its own page, since only "Publicar artículo" has a dedicated nav entry/mockup screen; edit was never depicted as its own screen.

### Requests (`/requests`)

Visual restyle only: status badges recolored (pending=amber-tint/amber-ink, approved/active=blue-tint/blue or forest-tint/forest-dark per the mockup's exact mapping, closed=neutral gray, rejected=red-tint/red), same table structure, same Approve/Reject logic and gating (`status === 'requested'`).

`mockData.ts`'s `mockRequests` gains 2 additional entries with `status: 'closed'` and `status: 'rejected'` (we currently have `requested`, `delivered`, and — after the final-review fix round — one `returned`) so the new badge styling has something to render for every status the mockup depicts. Each new entry follows the existing fixture shape exactly (fresh UUID-shaped `id`, references one of the existing `mockItems`, a distinct `renter_name` not colliding with existing ones, coherent past dates for `closed`/`rejected` since both represent finished reservation lifecycles, `deposit_status: 'released'` for the closed one and `'none'` for the rejected one). Existing entries are not modified (other tests reference them by index/id).

### Item detail (`/items/:id`)

This is the biggest content change. Replaces the current simple "list of unavailable-date chips" with:

1. **Two-month calendar grid** (Airbnb-style), showing the item's `unavailable_dates` painted as colored day cells (available=light gray, booked=red — pending is omitted here for the same reason as the availability strip: Phase 1 mock data doesn't model a separate "pending date" concept distinct from an approved/booked range).
2. **Working month navigation**: a "window start month" held in local component state (e.g., `useState` holding the first of the two displayed months). Clicking the left arrow moves the window back one month (month 2 becomes month 1, a new month slides in on the left... functionally: window start moves back by one month, so the two displayed months are `[windowStart, windowStart+1]`). Clicking the right arrow moves it forward one month. This is real, working client-side state — not wired to any date-range business logic, just a sliding display window over the same static mock `unavailable_dates`.
3. **Renter-history list** below the calendar: every `mockRequests` entry where `item_id` matches the current item, each row showing renter name, dates, and status badge (same badge treatment as `/requests`), **each row a `<Link>` to `/reservations/:id`** — this is how the reservation-detail page's close/deposit-history/report-problem functionality stays reachable even though the mockup's 6-screen deck doesn't show it as a distinct screen (see Context).

### Reservation detail (`/reservations/:id`)

Visual restyle only. Same close-reservation button (same `disabled` gating on `status === 'returned'`), same deposit transaction history table, same report-problem form (still available to both owner and renter, per the already-resolved product decision) — no functional changes.

### Earnings (`/earnings`)

Restructured from the current inline-expand-in-place list to a side-by-side selection layout: a left column of clickable item rows (reusing `mockEarnings.by_item`), a right-hand panel showing the selected item's date-range breakdown (reusing the same `mockEarnings.by_item[n].rentals` data, same `formatCentavos` calls, same "no renter identity" privacy rule). Selection state (`selectedItemId`) replaces the current `expandedItemId` — same underlying data, different interaction shape. Add the 3 top-level stat cards from the mockup ("Ganado en total", "Este mes", "Reservas cerradas") above the list — all derived from existing `mockEarnings`/`mockRequests` data, no new fixtures.

## Mock Data Changes Summary

All changes are additive or derived — no existing field names, types, or enum values change:
- `mockRequests`: add 2 entries with `status: 'closed'` and `status: 'rejected'`, following the existing fixture shape exactly (see the Requests section above for the precise field values expected).
- No new types needed in `apps/web/src/lib/types.ts` — KPIs, availability strips, and earnings stats are all computed from existing shapes at render time, not stored as new mock fields.

## Testing Approach

- Every existing test file that asserts on markup affected by the restyle (`ItemsPage`, `RequestsPage`, `EarningsPage`, `DashboardLayout`, `DashboardPage`) gets updated to match new class names/structure where needed — same behavioral assertions (renders X, clicking Y does Z), not weakened.
- New tests for genuinely new behavior:
  - `ItemDetailPage`: calendar renders the correct two starting months; clicking next/prev shifts the displayed months; renter-history rows link to the correct `/reservations/:id`.
  - `PublishItemPage` (new file, replacing the Dialog-based publish flow's test coverage in `ItemsPage.test.tsx`): form submission still creates an item with correct centavo conversion; live preview reflects typed values; Cancel navigates to `/items`.
  - `DashboardPage`: KPI card values match the derived counts from mock data; recent-requests preview shows only pending requests capped at 2.
  - `EarningsPage`: selecting a different item row updates the breakdown panel to that item's rentals.
- No reduction in coverage — the plan resulting from this spec must account for every existing test file that touches restyled markup.

## Explicitly Out of Scope

- Any change to `apps/mobile`'s colors/theming (the divergence noted in Context is accepted, not fixed, by this work).
- Real API integration (Phase 2, unchanged — still separately blocked on backend work per `apps/api/ROADMAP.md`).
- Full calendar business logic (real per-day availability computation, pending-vs-booked distinction) — Week 3 project scope, not this redesign.
- CI wiring (`.github/workflows/ci.yml`) — Wa's territory, unchanged.
- Any change to `packages/contracts/openapi.yaml`.
