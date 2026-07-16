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

**Explicit decision, made with the human: all user-facing UI text moves to Spanish**, matching the mockup exactly (nav labels, buttons, form labels, headings, status badge text) rather than leaving the current English text in place. This is a full translation pass across all 8 existing pages, not just the sidebar nav. Code identifiers (variable/function/component names, CSS classes, comments) stay in English, unchanged — only user-facing strings translate. The full label mapping (including reservation statuses the mockup's static demo doesn't show, like `approved`/`returned`/`cancelled`) is specified per-page below.

## Addendum (2026-07-15, revision 2): updated mockup, English-first i18n, `other` category

Silverk's mockup was updated after this spec's original palette/font decisions were made and 10 of the original plan's 17 tasks were already committed. This addendum supersedes the affected sections below; it does not restate parts of the original spec that are still accurate (page structure, KPI/availability-strip/calendar logic, mock-data shape).

**Source**: `c:\Users\josma\Downloads\RentaTodo Dashboard.html` — a newer export of the same 6-screen mockup (same pages: Resumen/Dashboard, Mis artículos/Items, Publicar/Publish, Solicitudes/Requests, Calendario, Ganancias/Earnings), with a changed palette, changed fonts, and a few structural refinements not present in the original `dashboard.html`.

**Explicit decision, made with the human, superseding the original "all text to Spanish" decision**: the app ships **English-first**, built through a lightweight i18n scaffold so Spanish (and other languages) can be added later without touching call sites. New module `apps/web/src/lib/i18n/`:
- `en.ts` — a nested string dictionary, one top-level key per feature area (`nav`, `login`, `register`, `statusBadge`, `itemCard`, `calendar`, `dashboard`, `items`, `requests`, `earnings`, `reservationDetail`, `categories`), only locale populated today.
- `index.ts` — exports `type Translations = typeof en` and `useTranslation(locale: 'en' = 'en'): Translations` (returns the dictionary directly; no Context/Provider yet since there is nothing to switch between). Components call `const t = useTranslation()` and read e.g. `t.nav.overview`. Adding a second locale later means dropping in `es.ts` satisfying `Translations` and wiring real locale selection into `useTranslation`'s default arg — no call-site changes.
- `apps/web/src/lib/categoryLabels.ts` (already committed, Task 6) folds into the dictionary as `t.categories` and is deleted as a standalone module.
- `apps/web/index.html`'s `lang="es"` (set by the already-committed Task 2) reverts to `lang="en"`.

**Migration scope for already-committed work**: the six components/pages committed under the original Spanish-first plan — `DashboardLayout`, `LoginPage`, `RegisterPage`, `StatusBadge`, `CalendarMonth`, `ItemCard` (plus their test files, plus `App.test.tsx`'s login-button-name assertion) — get their hardcoded Spanish string literals replaced with `t.*` lookups sourced from `en.ts`, with English content. This is a redo of *how strings are sourced and what language they're in*, not a redo of the component logic/markup structure itself (which stays as already built). Tasks 11-17 (not yet started) are built directly against the dictionary from the start.

**Palette**: `packages/design-tokens/tokens.ts`'s `colors` values (populated by the already-committed Task 1) are superseded by these new hex values — token names unchanged except five new additions:

| Token | Superseded old hex | New hex |
|---|---|---|
| `sidebar` | `#16231d` | `#141F19` |
| `sidebarHover` | `#1f3129` | `#1E2E26` |
| `sidebarBorder` | `#263a30` | `#263A30` (unchanged) |
| `sidebarForeground` | `#cfd9d2` | `#AEBBB3` |
| `bg` | `#f4f6f4` | `#EFEDE6` |
| `card` | `#ffffff` | `#FFFFFF` (unchanged) |
| `border` | `#e2e7e3` | `#E4E2D8` |
| `ink` | `#16221d` | `#17201B` |
| `inkSoft` | `#5c6b64` | `#5B655E` |
| `inkFaint` | `#94a39c` | `#9AA39C` |
| `forest` | `#2f6f4e` | `#1E7A4F` |
| `forestDark` | `#234f39` | `#155C3B` |
| `forestTint` | `#e7f1ea` | `#E2F0E7` |
| `amber` | `#d98c2b` | `#D9862A` |
| `amberInk` | `#241505` | `#241505` (unchanged) |
| `amberTint` | `#fbeed9` | `#F9ECD6` |
| `amberForeground` | `#9c6114` | `#8F550F` |
| `red` | `#c0442e` | `#C24A32` |
| `redTint` | `#f8e4df` | `#F7E1DA` |
| `blue` | `#3563a8` | `#33608F` |
| `blueTint` | `#e4ebf6` | `#E3EAF3` |
| `line` *(new)* | — | `#EFEEE7` — fine internal dividers (e.g. Earnings breakdown rows), distinct from `border` |
| `redBorder` *(new)* | — | `#ECCFC5` — destructive outline-button border, distinct from `redTint` (reserved for hover-fill) |
| `sidebarCard` *(new)* | — | `#1B2A22` — nested widget bg inside the sidebar (the "Ganado este mes" preview box) |
| `onDarkAccent` *(new)* | — | `#6FB88E` — green accent text/icon on dark surfaces (sidebar widget delta, dashboard's inverted KPI card) |
| `closedTint` *(new)* | — | `#ECEEEA` — closed-status badge background, distinct from `muted` |

The corresponding `apps/web/src/index.css` `:root` HSL values (populated by the already-committed Task 3) are recomputed from these new hex values, same variable names, no new CSS variables beyond the five new tokens above (added as new `--x` entries + matching `tailwind.config.ts` `theme.extend.colors` keys, same `hsl(var(--x))` pattern as `warning`/`info`).

**Fonts**: Space Grotesk → **Bricolage Grotesque** (weights 600/700/800, display/headings/KPI numbers), Inter → **Instrument Sans** (weights 400/500/600/700, body/UI), JetBrains Mono → **IBM Plex Mono** (weights 500/600, prices/dates) — same three-role `font-display`/`font-sans`/`font-mono` structure as the already-committed Task 2, new Google Fonts URL:
```
https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap
```

**Radius**: the new mockup uses a graduated per-component radius scale (16/14/11/10/9/7px, plus pill/circle) instead of a single token. Decision: shadcn primitives (`Button`, `Input`, `Dialog`, etc.) keep `--radius` (10px) untouched; bespoke dashboard components (KPI cards, `ItemCard`, `StatusBadge`) use Tailwind's built-in `rounded-lg`/`rounded-xl`/`rounded-2xl`/`rounded-full` utilities to visually approximate the mockup's tiers. No new radius design-token infrastructure — YAGNI.

**`StatusBadge` gains a colored dot** before the label (a small `rounded-full` swatch matching the badge's accent color), and its status→style mapping (superseding the original spec's table) is:

| `ReservationStatus` | English label | Badge bg / text / dot |
|---|---|---|
| `requested` | Pending | `amber-tint` bg / `amber-foreground` text / `amber` dot |
| `approved` | Approved | `forest-tint` (`secondary`) bg / `forest-dark` (`secondary-foreground`) text / `forest` dot |
| `delivered` | Active | `blue-tint` (`info-tint`) bg / `blue` (`info`) text / `blue` dot |
| `returned` | Active | same as `delivered` — both map to the mockup's single "active" visual state |
| `closed` | Closed | `closedTint` bg / `ink-soft` text / `ink-faint` dot |
| `rejected` | Rejected | `red-tint` bg / `red` text / `red` dot |
| `cancelled` | Rejected | same treatment as `rejected` — both terminal "did not happen" states |

**Dashboard KPI row**: the 4th stat card ("Earned this month") is dark-inverted (`sidebar` bg, `sidebarHover`/`sidebarCard` for its icon chip, `onDarkAccent` for the value/icon color) instead of the light-card treatment the other 3 KPI cards use. `EarningsPage`'s first stat card ("Total earned") gets the same dark-inverted background but with plain white text, no `onDarkAccent` — this asymmetry is intentional per the mockup, not a copy-paste of the same treatment.

**Category `other`**: origin/develop's `packages/contracts/openapi.yaml` (PR #13, not yet in this branch) added `'other'` to `CategoryEnum`. Decision: sync only this value manually (not a full merge of develop into this branch) — add `'other'` to `apps/web/src/lib/types.ts`'s `Category` union and to the i18n dictionary's `categories` map (`t.categories.other = 'Other'`), independent of the i18n migration task.

## Addendum (2026-07-16, revision 3): content pages — Items, Publish, Requests, Calendar, Earnings

Silverk sent 6 new screenshots of the updated mockup: `myarticles.png` (My items), `publisharticle.png` (Publish item), `requests.png` (Requests), `calendar.png` (Calendar), `earnings.png` (Earnings), `sidepanel.png` (sidebar). This addendum specs building/restyling the pages these depict — the deferred original-plan Tasks 11-17 — against the already-shipped i18n + revision-2 palette. It supersedes the original spec's "Layout & Navigation" and "Page-by-Page Changes" sections below wherever they conflict; sections not mentioned here (Reservation detail) are unaffected and stay as originally specced, just not built yet.

**Route changes** (supersedes the Global Constraints route list below): `/items/:id` is **removed** (see "Item detail retirement" below) and `/requests/calendar` is **added**. The route set becomes: `/login`, `/register`, `/dashboard`, `/items`, `/items/publish`, `/requests`, `/requests/calendar`, `/reservations/:id`, `/earnings`.

**All content in this addendum is English**, sourced through `apps/web/src/lib/i18n`'s dictionary, per the revision-2 decision — the source mockups are in Spanish (Silverk's working language) but every string below is specified in its English form directly; mock *data* (item names, renter names, descriptions) stays as-authored in `mockData.ts`, Spanish-flavored or not, since it's just fixture content, not UI chrome.

### Shared foundation

**`PageHeader`** (new, `apps/web/src/components/PageHeader.tsx`): renders a full-bleed white (`bg-card`) band with a `border-b border-border`, internal `px-four py-three`. Props: `title: string`, `subtitle: string`, `action?: ReactNode` (right-aligned). Every dashboard page (`DashboardPage`, `ItemsPage`, `PublishItemPage`, `RequestsPage`, `CalendarPage`, `EarningsPage`) renders this first, followed by a `<div className="p-four space-y-four">` for body content. Login/Register are unaffected (not inside `DashboardLayout`).

**`DashboardLayout` changes**:
- `<main>` drops `p-four` (each page now owns its own padding via `PageHeader` + body wrapper, per above).
- Sidebar `<aside>`: `w-60` → `w-72`. Nav link padding: `py-one` → `py-two`. Text size unchanged (`text-sm`) — the width increase plus larger padding is the "bigger, not tiny" fix; text is already legible.
- **Nav icons**: each `navGroups[].items[]` entry gains an `icon` (a `lucide-react` component), rendered at `h-5 w-5` immediately before the label, `flex-shrink-0`, with `gap-two` from the label text. Icon choices (closest `lucide-react` match to the mockup): Overview → `LayoutGrid`, My items → `Package`, Publish item → `Plus`, Requests → `MessageSquare`, Calendar → `Calendar`, Earnings → `DollarSign`.
- **New nav entry**: "Calendar" under the Activity group, alongside Requests, linking to `/requests/calendar`. (Supersedes the original spec's "no top-level Calendario nav item" decision — the newer mockup has one.)
- **Sidebar mini-widget**: a card above the user footer, `bg-sidebar-card` (new token, see below), `rounded-lg p-three`, showing `t.nav.earnedThisMonth` label + `formatCentavos(mockEarnings.total_earnings)` value in `text-on-dark-accent`, plus a delta line `+{pct}% vs last month` computed from the new `mockEarnings.by_month` array (current month vs. previous month, `Math.round(((current - previous) / previous) * 100)`).
- **Pending-badge fix**: the `/requests` nav-link count badge grows `h-5 w-5` (min-width, `px-half` removed in favor of fixed size) → `h-6 w-6`, and gains `flex items-center justify-center` so the digit is actually centered (today it's just a padded pill, not centered).

**New design token**: `sidebarCard` (`#1B2A22`, already named and reserved in the revision-2 palette table but never wired) gets added to `apps/web/src/index.css`'s `:root` (HSL) and `tailwind.config.ts`'s `theme.extend.colors` as `'sidebar-card': 'hsl(var(--sidebar-card))'`, following the exact pattern of the other revision-2 additions. `line`, `redBorder`, `closedTint` remain deferred — still no consumer after this addendum. (`closedTint` note: `StatusBadge`'s `closed` mapping already uses plain `bg-muted`, per the already-shipped revision-2 table — this addendum doesn't change that.)

### Item detail retirement

`/items/:id` (`ItemDetailPage.tsx` + its test) is **deleted**. None of the 6 real mockup screens depict a separate item-detail view — it existed only as a workaround host for the calendar, which now has its own proper page. `ItemCard`'s item name becomes plain text (no longer a `<Link>`); the "Calendar" button is the only drill-in, and now targets `/requests/calendar?item={id}` instead of `/items/{id}`.

`mockItemDetail()`, the `ItemDetail` type, and the `UnavailableRange` type become unreferenced once this lands and the availability derivation below replaces their only other consumer (`CalendarMonth`'s prop shape). Remove them if confirmed unreferenced at implementation time.

### Availability derivation (replaces the old 2-state system)

New function in `apps/web/src/lib/availability.ts`, `getItemDateStates(itemId: string): { start_date: string; end_date: string; state: 'pending' | 'reserved' }[]`, reading `mockRequests` directly (filtered by `item_id`): `status === 'requested'` → `'pending'`; `status` in `['approved', 'delivered', 'returned']` → `'reserved'`; `closed`/`rejected`/`cancelled` are excluded (they don't block dates). This becomes the single source of truth for both:
- `ItemCard`'s 14-day strip — `getAvailabilityStrip` is updated to accept these tagged ranges and return `('available' | 'pending' | 'reserved')[]`, replacing today's boolean-only `available`/`booked` result. Strip cell colors: available = `bg-muted` (unchanged), pending = `bg-warning/65`, reserved = `bg-destructive/65` (unchanged from today's "booked" color).
- The new `CalendarPage`'s two-month grid — `CalendarMonth`'s `unavailableDates: UnavailableRange[]` prop is replaced with `dateRanges: { start_date: string; end_date: string; state: 'pending' | 'reserved' }[]`, and its per-day coloring gains a third state: available = `bg-muted text-info` (unchanged), pending = `bg-warning font-bold text-warning-ink`, reserved = `bg-destructive font-bold text-destructive-foreground` (unchanged from today's "booked" styling). Today's `isDateBooked` boolean helper in `apps/web/src/lib/calendar.ts` is replaced with a `getDateState(dateStr, dateRanges): 'available' | 'pending' | 'reserved'` that checks reserved ranges before pending ranges (reserved takes precedence on the rare case of overlap).

### My items (`/items`)

- `PageHeader`: `title: t.items.title` ("My items"), `subtitle: t.items.subtitle(activeCount, inactiveCount)` → `"{n} active · {n} inactive"`, `action`: a "+ Publish item" button linking to `/items/publish`.
- Search input, placeholder `t.items.searchPlaceholder` ("Search by name or category…"), client-side substring filter (case-insensitive) against item name + category.
- `grid grid-cols-4 gap-three` of `ItemCard`.
- The existing Edit Dialog (pre-filled form, same fields/logic as today) stays in `ItemsPage`, now triggered only by each card's Edit button (no longer also the create trigger).
- `ItemCard` inactive state: replace today's "same 3 buttons regardless of `is_active`" with — active: Edit / Calendar / Delete (unchanged); inactive: **Reactivate** (`variant="default"`, sets `is_active: true` via the same `setItems` pattern `handleDelete` already uses) + Edit only, matching `myarticles.png`. Delete stays a soft-delete (`is_active: false`) exactly as today — no behavior change there, just confirming it's unchanged.

### Publish item (`/items/publish`, new route, create-only)

- `PublishItemPage.tsx`, `RequireAuth`-wrapped alongside the other dashboard routes.
- Two-column layout: form (left) + live preview (right, `ItemCard` in `readOnly` mode fed the in-progress form state, wrapped in a card labeled `t.publish.previewTitle` "How renters will see it").
- Fields, same as today's Dialog: name, category (now pill-button single-select instead of a `<select>`, matching `publisharticle.png` — same `Category[]` list, `aria-pressed` for the selected pill), price/day (USD, same centavo conversion), description (textarea), photo URL.
- Submit creates the item (same logic as today's create path) and navigates to `/items`. Cancel navigates to `/items` without saving.
- This is a container/extraction change, not new business logic — same validation, same centavo math, same navigation-on-success/-cancel behavior as the current Dialog.

### Requests (`/requests`)

- `PageHeader`: `title: t.requests.title` ("Requests"), `subtitle: t.requests.subtitle` ("Everything you've been asked to rent, in one place.").
- Three tabs with live counts, replacing the current single flat table: **Pending** (`status === 'requested'`), **Active** (`status` in `['approved', 'delivered', 'returned']`), **History** (`status` in `['closed', 'rejected', 'cancelled']`).
- Search input, placeholder `t.requests.searchPlaceholder` ("Search by person or item…"), filters the active tab's rows by renter name + item name substring.
- Rows: card style (`rounded-lg border border-border bg-card p-three`, replacing the shadcn `<Table>`), avatar circle (initials, same `getInitials` helper `DashboardLayout` already has — worth extracting to a shared util at implementation time), renter name + item name, dates + total, `StatusBadge`, and Approve/Reject buttons — buttons render only on the Pending tab (same `setStatus` logic as today). Each row is a `<Link>` to `/reservations/{id}`, unchanged destination.

### Calendar (`/requests/calendar`, new route, optional `?item=` query param)

- `PageHeader`: `title: t.calendar.title` ("Calendar"), `subtitle: t.calendar.subtitle` ("Availability by date, item by item."), `action`: a native `<select>` item picker (same unstyled-native-select pattern `ItemsPage`'s category filter already uses — no new dependency), listing all `mockItems` by name. Reads `?item=` on mount to preselect; defaults to `mockItems[0]` if absent/invalid.
- Two-month `CalendarMonth` grid, side by side, for the selected item — **current month + next month, no navigation controls** (explicitly simple, per decision — no prev/next arrows).
- Legend: three swatches + labels, `t.calendar.legend.available` ("Available"), `.pending` ("Pending"), `.reserved` ("Reserved").
- `t.calendar.reservationsHeading` ("Reservations for this item") list below: every `mockRequests` entry where `item_id` matches the selected item, each row showing renter name, dates, `StatusBadge` (reusing the existing component for consistency rather than the mockup's slightly different pill style), and linking to `/reservations/{id}`.

### Earnings (`/earnings`)

- `PageHeader`: `title: t.earnings.title` ("Earnings"), `subtitle: t.earnings.subtitle` ("Track what each item earns you.").
- 3 KPI cards: **Total earned** (`t.earnings.kpiTotal`, dark-inverted `bg-sidebar` like the dashboard's 4th card, but plain white text — not `text-on-dark-accent` — per the already-shipped revision-2 note on this exact asymmetry), **This month** (`t.earnings.kpiThisMonth`, light card, latest entry of `mockEarnings.by_month`), **Closed reservations** (`t.earnings.kpiClosedCount`, light card, `mockRequests.filter(r => r.status === 'closed').length`).
- New bar chart, `t.earnings.chartTitle` ("Earnings by month") / `t.earnings.chartSubtitle` ("Last 6 months"): plain CSS/Tailwind bars (no charting library — no new dependency, matches the mockup's static, non-interactive bars exactly), one per `mockEarnings.by_month` entry, height = `(entry.total / max(...by_month.map(m => m.total))) * 100%`, value label above each bar, month label below, current month's bar `bg-primary` (solid), prior months `bg-secondary` (tint) — mirrors the mockup's current-month highlight.
- "By item" section: left column, clickable `mockEarnings.by_item` rows with a progress bar (`width: (item.total / max(...by_item.map(i => i.total))) * 100%`, `bg-secondary`/`bg-primary` fill), reservation count (`item.rentals.length`) + total; right column shows the selected item's `rentals` breakdown (unchanged data/logic from today's expand-in-place list) plus the existing privacy note. `selectedItemId` state replaces today's `expandedItemId` — same data, selection instead of expand/collapse.

### New mock data

The only new fixture shape this addendum needs: `mockEarnings.by_month: { month: string; total: number }[]` in `apps/web/src/lib/mockData.ts` — 6 entries (Feb–Jul 2026, illustrative values consistent with the existing `by_item` totals, last entry = current month = `total_earnings`'s most recent contribution). Add a matching `EarningsByMonth` interface + `by_month` field to the `Earnings` type in `apps/web/src/lib/types.ts`. No other type/enum changes.

### i18n dictionary additions

New top-level keys in `apps/web/src/lib/i18n/en.ts`: `items` (title, subtitle fn, searchPlaceholder, reactivate), `publish` (title, field labels, previewTitle, cancel, submit), `requests` (title, subtitle, tab labels, searchPlaceholder — supersedes the old flat-table strings from the original spec's "UI Text" section), `calendar` (extends the existing key: title, subtitle, legend.*, reservationsHeading — the existing `weekdays`/`months` sub-keys are unchanged), `earnings` (title, subtitle, kpi labels, chartTitle, chartSubtitle, byItemHeading, breakdownHeading, privacyNote). One new `nav.calendar` key and one new `nav.earnedThisMonth` key (sidebar widget label). `DashboardPage` switches its inline header markup to render `<PageHeader>` instead, using its existing `t.dashboard.title`/`welcomeBack` strings unchanged.

### Testing

New/updated test coverage, no reduction anywhere: `PageHeader` (new, renders title/subtitle/action, white background class), `DashboardLayout` (icon presence, new Calendar nav link, badge sizing/centering classes, sidebar widget renders the derived delta), `ItemsPage` (grid rendering, search filtering, reactivate flow), `ItemCard` (reactivate button on inactive items, name no longer a link, Calendar link target, 3-state strip colors), `PublishItemPage` (new — form submission creates item with correct centavo conversion, live preview reflects typed values, Cancel navigates to `/items`), `RequestsPage` (tab counts and filtering, search filtering, row still links to `/reservations/:id`), `CalendarPage` (new — item selection via dropdown and via `?item=` query param, 3-state grid rendering, reservations list), `EarningsPage` (KPI values, chart renders 6 bars, row selection updates the breakdown panel). `ItemDetailPage.test.tsx` is deleted along with the page.

### Explicitly out of scope (this addendum)

- `ReservationDetailPage` restyle/i18n — no mockup provided for it this round; stays exactly as-is, still reachable from Requests/Calendar rows.
- Real API integration (unchanged — still Phase 2, blocked on backend work).
- Calendar month navigation (prev/next arrows) — deliberately simplified out per the human's explicit instruction.
- Any `apps/mobile` change.
- The deferred `line`/`redBorder`/`closedTint` tokens — still no consumer after this addendum.

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

Separately, `warning`/`info`/`destructive-tint` genuinely are new — shadcn's default palette has no pending/active-state color slot, and no light-tint variant of `destructive`. These are real additions to `apps/web/tailwind.config.ts`'s `theme.extend.colors` (not present today). **Corrected after checking every actual mockup use-site** (the original draft conflated two different "text on amber" contexts and included an unused white-on-solid-blue variant that the mockup never uses):

```
--warning: 33 70% 51%;             /* amber — solid fill, e.g. avatar bg, nav count-badge bg */
--warning-ink: 31 76% 8%;          /* near-black text ON solid --warning (avatar initials, count-badge text) */
--warning-tint: 37 81% 92%;        /* light amber bg, for the "requested/pending" status badge */
--warning-foreground: 34 77% 35%;  /* medium amber-brown text ON --warning-tint (mockup's badge-pending text, #9c6114) */
--info: 216 52% 43%;               /* blue — the mockup never fills a solid blue background; blue is only ever text/accent on a light bg, so there is no white-on-solid-blue "info-foreground" */
--info-tint: 217 50% 93%;          /* light blue bg, for request avatars and the "delivered/active" status badge, paired with text-info */
--destructive-tint: 12 64% 92%;    /* light red bg for the "rejected/cancelled" status badge, paired with the EXISTING text-destructive (no new red text token needed — --destructive already is the right hue) */
```

`apps/web/tailwind.config.ts`'s `theme.extend.colors` gains `warning`/`warning-ink`/`warning-tint`/`warning-foreground`, `info`/`info-tint` (no `info-foreground`), and `destructive-tint` as new keys (`hsl(var(--x))`-wrapped, same pattern as the existing `primary`/`destructive`/etc.) — the `sidebar` key already exists in the file and only needs its CSS variables defined, not new Tailwind config. Lighter sidebar text shades used ad hoc in the mockup (`#b7c4bd` nav-item text, `#8a988f` footer-role text, `#6b7a72` section-label text) are approximated via Tailwind opacity modifiers on `sidebar-foreground` (e.g. `text-sidebar-foreground/80`) rather than more named tokens — YAGNI, avoids one-off token proliferation for text-opacity variance.

### Fonts

Add to `apps/web/index.html`'s `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```
`apps/web/tailwind.config.ts`'s `theme.extend.fontFamily` gains `display: ['"Space Grotesk"', 'sans-serif']` (headings), `sans: ['Inter', 'sans-serif']` (body, explicit rather than relying on Tailwind's default stack), `mono: ['"JetBrains Mono"', 'monospace']` (dates, prices, ids — used via `font-mono` utility, replacing ad hoc `font-family` usage).

### Radius

`--radius` becomes `0.625rem` (10px), up from `0.5rem`. shadcn's generated components already reference `var(--radius)` via `rounded-lg`/`rounded-md`/`rounded-sm` in `tailwind.config.ts`'s `borderRadius` extension (Task 4) — no component code changes needed, just the variable value.

### UI Text (Spanish)

Reservation status labels (used everywhere a `ReservationStatus` is displayed — `RequestsPage`, `ItemDetailPage`'s renter list, `ReservationDetailPage`), with the badge color treatment each maps to:

| `ReservationStatus` | Spanish label | Badge colors |
|---|---|---|
| `requested` | Solicitada | `warning-tint` bg / `warning-foreground` text (amber) |
| `approved` | Aprobada | `forest-tint` (`secondary`) bg / `forest-dark` (`secondary-foreground`) text |
| `delivered` | Entregada | `info-tint` bg / `info` text (blue) |
| `returned` | Devuelta | `info-tint` bg / `info` text (blue) — same as `delivered`; both are "in progress, not yet closed" |
| `closed` | Cerrada | `muted` bg / `muted-foreground` text (neutral gray) |
| `rejected` | Rechazada | `destructive-tint` bg / `destructive` text |
| `cancelled` | Cancelada | same treatment as `rejected` — both are terminal "did not happen" states |

Other common UI strings, by page (only strings that exist today and are changing — new page content's strings are specified inline in each page's section below):

- **Nav (`DashboardLayout`)**: Resumen, Mis artículos, Publicar artículo, Solicitudes, Ganancias, Cerrar sesión (logout button)
- **Login**: "Iniciar sesión" (heading + submit button), "Correo electrónico" (email label), "Contraseña" (password label)
- **Register**: "Crear cuenta" (heading + submit button), "Nombre" (name label), "Correo electrónico", "Contraseña"
- **My items**: "Mis artículos" (heading), "Publicar artículo" (button), "Editar", "Eliminar", "Calendario" (per-card buttons), "Inactivo" (badge)
- **Requests**: "Solicitudes" (heading), "Arrendatario" (Renter column), "Fechas" (Dates column), "Estado" (Status column), "Acciones" (Actions column), "Aprobar", "Rechazar" (action buttons)
- **Item detail**: "Disponibilidad" (calendar section heading), "Mes anterior"/"Mes siguiente" (nav button `aria-label`s), "Reservas de este artículo" (renter-history heading)
- **Reservation detail**: "Cerrar reserva" (close button), "Historial de depósito" (deposit history heading), "Tipo"/"Monto"/"Fecha" (transaction table columns), "Reportar un problema" (report heading), "¿Qué salió mal?" (reason label), "URL de la foto" (photo label), "Enviar reporte" (submit button), "Reporte enviado." (confirmation text)
- **Earnings**: "Ganancias" (heading), "Por artículo" (item list heading)

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
