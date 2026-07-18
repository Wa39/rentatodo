# Dashboard Content Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deferred My items / Publish item / Requests / Calendar / Earnings pages against 6 new mockup screenshots, plus a shared white `PageHeader` banner and a bigger sidebar with icons.

**Architecture:** A new `PageHeader` component gives every dashboard page a full-bleed white title band (`DashboardLayout`'s `<main>` loses its padding so pages can do this). `ItemCard` gets richer (reactivate, 3-state availability) and is reused as a read-only live preview on the new `PublishItemPage`. A single `getItemDateStates` function (reading `mockRequests`) becomes the one source of truth for "available/pending/reserved" coloring, consumed by both `ItemCard`'s strip and the new `CalendarPage`'s grid. `/items/:id` is retired; `/requests/calendar` is added.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind, shadcn/ui, `lucide-react` (already a dependency, used here for the first time), Vitest + Testing Library.

## Global Constraints

- Scope: `apps/web` + `packages/design-tokens` only. Never `apps/api`, `apps/mobile`, `.github/`, `e2e/`, `infra/`, `packages/contracts/openapi.yaml`.
- Phase 1 only: no real network calls. Every page reads from `apps/web/src/lib/mockData.ts`.
- All user-facing text is English, sourced through `apps/web/src/lib/i18n`'s dictionary — never a hardcoded string literal in component JSX. Mock *data* (names, descriptions) is unaffected by this rule.
- Money: integer USD centavos everywhere, `formatCentavos` for display.
- `Category`, `ReservationStatus`, `DepositStatus`, `TransactionType` values are unchanged.
- Route set becomes: `/login`, `/register`, `/dashboard`, `/items`, `/items/publish`, `/requests`, `/requests/calendar`, `/reservations/:id`, `/earnings`. `/items/:id` is removed.
- No new dependencies — the earnings bar chart is plain CSS/Tailwind, the calendar item-picker is a native `<select>`.
- Every existing test file touching markup this plan changes gets updated in the same task that changes the markup — never left red, never deleted to "fix" a failure.
- Full source: `docs/superpowers/specs/2026-07-15-dashboard-visual-redesign-design.md`, section `## Addendum (2026-07-16, revision 3)`.

---

### Task 1: Add the `sidebarCard` design token

**Files:**
- Modify: `packages/design-tokens/tokens.ts`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/tailwind.config.ts`

**Interfaces:**
- Produces: `bg-sidebar-card` Tailwind utility, consumed by Task 11's sidebar widget.

- [ ] **Step 1: Add the hex value to `packages/design-tokens/tokens.ts`**

Add this line right after `sidebarForeground: '#AEBBB3',`:

```ts
  sidebarCard: '#1B2A22',
```

- [ ] **Step 2: Add the CSS variable to `apps/web/src/index.css`**

Inside the `:root` block, add this line right after `--sidebar-border: 150 21% 19%;`:

```css
    --sidebar-card: 148 22% 14%;
```

- [ ] **Step 3: Wire it into `apps/web/tailwind.config.ts`**

Inside `theme.extend.colors.sidebar` (the existing object with `DEFAULT`, `foreground`, `primary`, etc.), add:

```ts
        card: 'hsl(var(--sidebar-card))',
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @rentatodo/web build`
Expected: exits 0 (nothing consumes `bg-sidebar-card` yet — Task 11 is the first consumer — so this just confirms nothing broke).

- [ ] **Step 5: Commit**

```bash
git add packages/design-tokens/tokens.ts apps/web/src/index.css apps/web/tailwind.config.ts
git commit -m "feat(web): add sidebarCard design token"
```

---

### Task 2: Extract `getInitials` to `lib/format.ts`

**Files:**
- Modify: `apps/web/src/lib/format.ts`
- Modify: `apps/web/src/lib/format.test.ts`
- Modify: `apps/web/src/layouts/DashboardLayout.tsx`

**Interfaces:**
- Produces: `getInitials(name: string): string`, consumed by Task 11 (`DashboardLayout`) and Task 15 (`RequestsPage`).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatCentavos, getInitials } from './format'

describe('getInitials', () => {
  it('returns the first letter of the first two words, uppercased', () => {
    expect(getInitials('María Vargas')).toBe('MV')
  })

  it('handles a single-word name', () => {
    expect(getInitials('Cher')).toBe('C')
  })
})
```

(Keep the existing `formatCentavos` describe block below this, unchanged.)

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- format.test`
Expected: FAIL — `Cannot find export 'getInitials'`.

- [ ] **Step 3: Add `getInitials` to `apps/web/src/lib/format.ts`**

```ts
export function formatCentavos(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
```

- [ ] **Step 4: Update `apps/web/src/layouts/DashboardLayout.tsx`**

Remove the local `getInitials` function (lines 7-14 of the current file) and add this import alongside the existing ones:

```ts
import { getInitials } from '@/lib/format'
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- format.test DashboardLayout.test`
Expected: PASS (5 tests total: 2 new + 3 `formatCentavos` + 2 existing `DashboardLayout` — the `DashboardLayout` output is unchanged, only its source moved).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/format.ts apps/web/src/lib/format.test.ts apps/web/src/layouts/DashboardLayout.tsx
git commit -m "refactor(web): extract getInitials to lib/format.ts"
```

---

### Task 3: Add monthly earnings mock data

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/mockData.ts`
- Modify: `apps/web/src/lib/mockData.test.ts`

**Interfaces:**
- Produces: `Earnings.by_month: EarningsByMonth[]`, consumed by Task 11 (sidebar widget), Task 17 (`EarningsPage` chart + "This month" KPI).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/mockData.test.ts`, inside the existing `describe('mockData', ...)` block:

```ts
  it('mockEarnings.by_month has 6 integer entries summing to total_earnings', () => {
    expect(mockEarnings.by_month).toHaveLength(6)
    for (const entry of mockEarnings.by_month) {
      expect(Number.isInteger(entry.total)).toBe(true)
    }
    const sum = mockEarnings.by_month.reduce((acc, entry) => acc + entry.total, 0)
    expect(sum).toBe(mockEarnings.total_earnings)
  })
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- mockData.test`
Expected: FAIL — `mockEarnings.by_month` is `undefined`.

- [ ] **Step 3: Add the type to `apps/web/src/lib/types.ts`**

Add this interface right after `EarningsByItem`, and add the `by_month` field to `Earnings`:

```ts
export interface EarningsByMonth {
  month: string
  total: number
}

export interface Earnings {
  total_earnings: number
  by_item: EarningsByItem[]
  by_month: EarningsByMonth[]
}
```

(Replace the existing `Earnings` interface, which currently lacks `by_month`.)

- [ ] **Step 4: Add the data to `apps/web/src/lib/mockData.ts`**

Inside the `mockEarnings` object, add `by_month` alongside the existing `by_item`:

```ts
  by_month: [
    { month: 'Feb', total: 800 },
    { month: 'Mar', total: 1100 },
    { month: 'Apr', total: 900 },
    { month: 'May', total: 1300 },
    { month: 'Jun', total: 1200 },
    { month: 'Jul', total: 1700 },
  ],
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- mockData.test`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/mockData.ts apps/web/src/lib/mockData.test.ts
git commit -m "feat(web): add 6-month earnings mock data"
```

---

### Task 4: Expand the i18n dictionary

**Files:**
- Modify: `apps/web/src/lib/i18n/en.ts`
- Modify: `apps/web/src/lib/i18n/index.test.ts`

**Interfaces:**
- Produces: `t.nav.calendar`, `t.nav.earnedThisMonth`, `t.nav.vsLastMonth`; `t.itemCard.reactivate`; `t.calendar.title/subtitle/legend/reservationsHeading`; `t.items.*`; `t.publish.*`; `t.requests.*`; `t.earnings.*`. Consumed by Tasks 10-17.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/i18n/index.test.ts`, inside the existing `describe('useTranslation', ...)` block:

```ts
  it('has the new nav, item-card, calendar, items, publish, requests, and earnings keys', () => {
    const t = useTranslation()
    expect(t.nav.calendar).toBe('Calendar')
    expect(t.nav.earnedThisMonth).toBe('Earned this month')
    expect(t.itemCard.reactivate).toBe('Reactivate')
    expect(t.calendar.legend.pending).toBe('Pending')
    expect(t.items.title).toBe('My items')
    expect(t.publish.submit).toBe('Publish item')
    expect(t.requests.tabPending).toBe('Pending')
    expect(t.earnings.kpiTotal).toBe('Total earned')
    expect(t.earnings.reservationCount(1)).toBe('1 closed reservation')
    expect(t.earnings.reservationCount(3)).toBe('3 closed reservations')
  })
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- i18n/index.test`
Expected: FAIL — `t.items` (and the others) are `undefined`.

- [ ] **Step 3: Update `apps/web/src/lib/i18n/en.ts`**

In the existing `nav` key, add two lines after `ownerRole: 'Owner',`:

```ts
    calendar: 'Calendar',
    earnedThisMonth: 'Earned this month',
    vsLastMonth: 'vs. last month',
```

In the existing `itemCard` key, add one line after `perDay: '/day',`:

```ts
    reactivate: 'Reactivate',
```

Replace the existing `calendar` key entirely with:

```ts
  calendar: {
    title: 'Calendar',
    subtitle: 'Availability by date, item by item.',
    weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
    legend: {
      available: 'Available',
      pending: 'Pending',
      reserved: 'Reserved',
    },
    reservationsHeading: 'Reservations for this item',
  },
```

Add four new top-level keys after the `categories` key and before `dashboard`:

```ts
  items: {
    title: 'My items',
    subtitle: (active: number, inactive: number) => `${active} active · ${inactive} inactive`,
    searchPlaceholder: 'Search by name or category…',
  },
  publish: {
    title: 'Publish item',
    subtitle: 'List a new item for renters to discover.',
    name: 'Name',
    category: 'Category',
    price: 'Price per day (USD)',
    description: 'Description',
    photo: 'Photo',
    previewTitle: 'How renters will see it',
    previewEmptyName: 'Item name',
    previewEmptyDescription: 'The description you write will show up here.',
    cancel: 'Cancel',
    submit: 'Publish item',
  },
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
  earnings: {
    title: 'Earnings',
    subtitle: 'Track what each item earns you.',
    kpiTotal: 'Total earned',
    kpiThisMonth: 'This month',
    kpiClosedCount: 'Closed reservations',
    chartTitle: 'Earnings by month',
    chartSubtitle: 'Last 6 months',
    byItemHeading: 'By item',
    byItemSubtitle: 'Click an item to see the breakdown.',
    breakdownSubtitle: "Breakdown by date range — renter identity isn't shown.",
    privacyNote:
      'We show amounts by date range, not by person — so the focus stays on how much you earned, without exposing who rented each time.',
    reservationCount: (n: number) => `${n} closed reservation${n === 1 ? '' : 's'}`,
  },
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- i18n/index.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/i18n/en.ts apps/web/src/lib/i18n/index.test.ts
git commit -m "feat(web): expand i18n dictionary for items/publish/requests/calendar/earnings"
```

---

### Task 5: Add `DateRangeState` type and `getItemDateStates`

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/availability.ts`
- Modify: `apps/web/src/lib/availability.test.ts`

**Interfaces:**
- Produces: `type ReservationDateState = 'pending' | 'reserved'`; `interface DateRangeState { start_date: string; end_date: string; state: ReservationDateState }`; `getItemDateStates(itemId: string, reservations: Reservation[]): DateRangeState[]`. Consumed by Task 6 (`calendar.ts`), Task 7 (`getAvailabilityStrip`), Task 10 (`ItemCard`), Task 16 (`CalendarPage`).

- [ ] **Step 1: Write the failing test**

Replace `apps/web/src/lib/availability.test.ts` entirely with:

```ts
import { describe, expect, it } from 'vitest'
import { getItemDateStates } from './availability'
import { mockItems, mockRequests } from './mockData'

describe('getItemDateStates', () => {
  it('classifies a requested reservation as pending', () => {
    const itemId = mockItems[0].id
    const states = getItemDateStates(itemId, mockRequests)
    const pending = mockRequests.find((r) => r.item_id === itemId && r.status === 'requested')!
    expect(states).toContainEqual({
      start_date: pending.start_date,
      end_date: pending.end_date,
      state: 'pending',
    })
  })

  it('classifies approved/delivered/returned reservations as reserved', () => {
    const itemId = mockItems[1].id
    const states = getItemDateStates(itemId, mockRequests)
    const reserved = mockRequests.find((r) => r.item_id === itemId && r.status === 'delivered')!
    expect(states).toContainEqual({
      start_date: reserved.start_date,
      end_date: reserved.end_date,
      state: 'reserved',
    })
  })

  it('excludes closed, rejected, and cancelled reservations', () => {
    const itemId = mockItems[0].id
    const states = getItemDateStates(itemId, mockRequests)
    const excluded = mockRequests.filter(
      (r) => r.item_id === itemId && ['closed', 'rejected', 'cancelled'].includes(r.status),
    )
    for (const reservation of excluded) {
      expect(states).not.toContainEqual(
        expect.objectContaining({ start_date: reservation.start_date, end_date: reservation.end_date }),
      )
    }
  })

  it('excludes reservations for other items', () => {
    expect(getItemDateStates('nonexistent-item-id', mockRequests)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- availability.test`
Expected: FAIL — `getItemDateStates` is not exported, and the old `getAvailabilityStrip` tests that used to live in this file are gone (that's expected — Task 7 rewrites them).

- [ ] **Step 3: Add the type to `apps/web/src/lib/types.ts`**

Add this right after the `Reservation` interface, before `TransactionType`:

```ts
export type ReservationDateState = 'pending' | 'reserved'

export interface DateRangeState {
  start_date: string
  end_date: string
  state: ReservationDateState
}
```

- [ ] **Step 4: Replace `apps/web/src/lib/availability.ts`**

```ts
import type { DateRangeState, Reservation } from './types'

const RESERVED_STATUSES = ['approved', 'delivered', 'returned']

export function getItemDateStates(itemId: string, reservations: Reservation[]): DateRangeState[] {
  return reservations
    .filter((r) => r.item_id === itemId)
    .filter((r) => r.status === 'requested' || RESERVED_STATUSES.includes(r.status))
    .map((r) => ({
      start_date: r.start_date,
      end_date: r.end_date,
      state: r.status === 'requested' ? 'pending' : 'reserved',
    }))
}
```

(This temporarily drops `getAvailabilityStrip` — Task 7 adds it back in its new 3-state form. `ItemCard` and `CalendarMonth` are mid-migration and will not compile between this task and Task 8; that's expected, matching the plan's normal multi-task sequencing.)

- [ ] **Step 5: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- availability.test`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/availability.ts apps/web/src/lib/availability.test.ts
git commit -m "feat(web): add getItemDateStates, the new source of truth for item availability"
```

---

### Task 6: Replace `isDateBooked` with `getDateState`

**Files:**
- Modify: `apps/web/src/lib/calendar.ts`
- Modify: `apps/web/src/lib/calendar.test.ts`

**Interfaces:**
- Consumes: `DateRangeState` from Task 5.
- Produces: `getDateState(dateStr: string, dateRanges: DateRangeState[]): 'available' | 'pending' | 'reserved'`. Consumed by Task 7 (`getAvailabilityStrip`) and Task 8 (`CalendarMonth`).

- [ ] **Step 1: Write the failing test**

In `apps/web/src/lib/calendar.test.ts`, replace the `import` line and the final `describe('isDateBooked', ...)` block:

```ts
import { describe, expect, it } from 'vitest'
import { getDateState, getMonthGridDays, toDateOnlyString } from './calendar'
```

```ts
describe('getDateState', () => {
  const dateRanges = [
    { start_date: '2026-07-18', end_date: '2026-07-20', state: 'reserved' as const },
    { start_date: '2026-07-25', end_date: '2026-07-25', state: 'pending' as const },
  ]

  it('returns reserved for a date inside a reserved range', () => {
    expect(getDateState('2026-07-19', dateRanges)).toBe('reserved')
  })

  it('returns reserved for a range boundary date', () => {
    expect(getDateState('2026-07-18', dateRanges)).toBe('reserved')
    expect(getDateState('2026-07-20', dateRanges)).toBe('reserved')
  })

  it('returns pending for a date inside a pending range', () => {
    expect(getDateState('2026-07-25', dateRanges)).toBe('pending')
  })

  it('returns available for a date outside every range', () => {
    expect(getDateState('2026-07-21', dateRanges)).toBe('available')
  })

  it('prioritizes reserved over pending on an overlapping date', () => {
    const overlapping = [
      { start_date: '2026-08-01', end_date: '2026-08-01', state: 'pending' as const },
      { start_date: '2026-08-01', end_date: '2026-08-01', state: 'reserved' as const },
    ]
    expect(getDateState('2026-08-01', overlapping)).toBe('reserved')
  })
})
```

(Leave the `getMonthGridDays` and `toDateOnlyString` describe blocks above this one exactly as they are.)

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- calendar.test`
Expected: FAIL — `getDateState` is not exported.

- [ ] **Step 3: Replace `isDateBooked` in `apps/web/src/lib/calendar.ts`**

Change the import at the top from `import type { UnavailableRange } from './types'` to:

```ts
import type { DateRangeState } from './types'
```

Replace the `isDateBooked` function (the last function in the file) with:

```ts
export function getDateState(dateStr: string, dateRanges: DateRangeState[]): 'available' | 'pending' | 'reserved' {
  const reserved = dateRanges.some((r) => r.state === 'reserved' && dateStr >= r.start_date && dateStr <= r.end_date)
  if (reserved) return 'reserved'
  const pending = dateRanges.some((r) => r.state === 'pending' && dateStr >= r.start_date && dateStr <= r.end_date)
  if (pending) return 'pending'
  return 'available'
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- calendar.test`
Expected: PASS (9 tests: 4 existing `getMonthGridDays` + 2 existing `toDateOnlyString` + 5 new `getDateState`, wait — no `isDateBooked` tests remain since replaced. Total: 4 + 2 + 5 = 11 tests.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/calendar.ts apps/web/src/lib/calendar.test.ts
git commit -m "feat(web): replace isDateBooked with 3-state getDateState"
```

---

### Task 7: Update `getAvailabilityStrip` to 3 states

**Files:**
- Modify: `apps/web/src/lib/availability.ts`
- Modify: `apps/web/src/lib/availability.test.ts`

**Interfaces:**
- Consumes: `getDateState` from Task 6, `DateRangeState` from Task 5.
- Produces: `getAvailabilityStrip(dateRanges: DateRangeState[], referenceDate?: Date, days?: number): ('available' | 'pending' | 'reserved')[]`. Consumed by Task 10 (`ItemCard`).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/availability.test.ts`, after the existing `getItemDateStates` describe block:

```ts
describe('getAvailabilityStrip', () => {
  it('returns 14 entries by default', () => {
    const strip = getAvailabilityStrip([], new Date(2026, 6, 1))
    expect(strip).toHaveLength(14)
  })

  it('marks days inside a reserved range as reserved', () => {
    const strip = getAvailabilityStrip(
      [{ start_date: '2026-07-03', end_date: '2026-07-04', state: 'reserved' }],
      new Date(2026, 6, 1),
    )
    expect(strip[0]).toBe('available') // Jul 1
    expect(strip[2]).toBe('reserved') // Jul 3
    expect(strip[3]).toBe('reserved') // Jul 4
    expect(strip[4]).toBe('available') // Jul 5
  })

  it('marks days inside a pending range as pending', () => {
    const strip = getAvailabilityStrip(
      [{ start_date: '2026-07-06', end_date: '2026-07-06', state: 'pending' }],
      new Date(2026, 6, 1),
    )
    expect(strip[5]).toBe('pending') // Jul 6
  })
})
```

Update the import line at the top to:

```ts
import { describe, expect, it } from 'vitest'
import { getAvailabilityStrip, getItemDateStates } from './availability'
import { mockItems, mockRequests } from './mockData'
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- availability.test`
Expected: FAIL — `getAvailabilityStrip` is not exported.

- [ ] **Step 3: Add `getAvailabilityStrip` back to `apps/web/src/lib/availability.ts`**

```ts
import { getDateState, toDateOnlyString } from './calendar'
import type { DateRangeState, Reservation } from './types'

const RESERVED_STATUSES = ['approved', 'delivered', 'returned']

export function getItemDateStates(itemId: string, reservations: Reservation[]): DateRangeState[] {
  return reservations
    .filter((r) => r.item_id === itemId)
    .filter((r) => r.status === 'requested' || RESERVED_STATUSES.includes(r.status))
    .map((r) => ({
      start_date: r.start_date,
      end_date: r.end_date,
      state: r.status === 'requested' ? 'pending' : 'reserved',
    }))
}

export type AvailabilityDay = 'available' | 'pending' | 'reserved'

export function getAvailabilityStrip(
  dateRanges: DateRangeState[],
  referenceDate: Date = new Date(),
  days = 14,
): AvailabilityDay[] {
  const strip: AvailabilityDay[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + i)
    strip.push(getDateState(toDateOnlyString(date), dateRanges))
  }
  return strip
}
```

(This is a full-file replacement — `getItemDateStates` from Task 5 is unchanged, `getAvailabilityStrip` is new.)

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- availability.test`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/availability.ts apps/web/src/lib/availability.test.ts
git commit -m "feat(web): restore getAvailabilityStrip with 3-state coloring"
```

---

### Task 8: Update `CalendarMonth` to 3 states

**Files:**
- Modify: `apps/web/src/components/CalendarMonth.tsx`
- Modify: `apps/web/src/components/CalendarMonth.test.tsx`

**Interfaces:**
- Consumes: `getDateState` from Task 6, `DateRangeState` from Task 5.
- Produces: `CalendarMonth({ monthStart: Date, dateRanges: DateRangeState[] })` (replaces the `unavailableDates: UnavailableRange[]` prop). Consumed by Task 16 (`CalendarPage`).

- [ ] **Step 1: Write the failing test**

Replace `apps/web/src/components/CalendarMonth.test.tsx` entirely with:

```tsx
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarMonth } from './CalendarMonth'

describe('CalendarMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 14))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the month label and marks reserved and pending dates', () => {
    render(
      <CalendarMonth
        monthStart={new Date(2026, 6, 1)}
        dateRanges={[
          { start_date: '2026-07-18', end_date: '2026-07-20', state: 'reserved' },
          { start_date: '2026-07-22', end_date: '2026-07-22', state: 'pending' },
        ]}
      />,
    )

    expect(screen.getByText('July 2026')).toBeInTheDocument()
    expect(screen.getByText('18')).toHaveClass('bg-destructive')
    expect(screen.getByText('17')).not.toHaveClass('bg-destructive')
    expect(screen.getByText('22')).toHaveClass('bg-warning')
    expect(screen.getByText('14')).toHaveClass('ring-primary')
    expect(screen.getByText('13')).not.toHaveClass('ring-primary')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- CalendarMonth.test`
Expected: FAIL — `dateRanges` prop doesn't exist yet, component still expects `unavailableDates`.

- [ ] **Step 3: Replace `apps/web/src/components/CalendarMonth.tsx`**

```tsx
import { getDateState, getMonthGridDays, toDateOnlyString } from '@/lib/calendar'
import { useTranslation } from '@/lib/i18n'
import type { DateRangeState } from '@/lib/types'

export function CalendarMonth({
  monthStart,
  dateRanges,
}: {
  monthStart: Date
  dateRanges: DateRangeState[]
}) {
  const t = useTranslation()
  const days = getMonthGridDays(monthStart)
  const label = `${t.calendar.months[monthStart.getMonth()]} ${monthStart.getFullYear()}`

  return (
    <div>
      <div className="mb-two font-display text-base font-bold text-foreground">{label}</div>
      <div className="mb-two grid grid-cols-7 text-xs font-semibold uppercase text-info">
        {t.calendar.weekdays.map((weekday, index) => (
          <div key={index} className="p-half text-center">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateStr = toDateOnlyString(day.date)
          const state = day.inCurrentMonth ? getDateState(dateStr, dateRanges) : 'available'
          return (
            <div
              key={dateStr}
              className={`flex aspect-square items-center justify-center rounded-md text-sm font-medium ${
                !day.inCurrentMonth
                  ? 'text-muted-foreground opacity-30'
                  : state === 'reserved'
                    ? 'bg-destructive font-bold text-destructive-foreground'
                    : state === 'pending'
                      ? 'bg-warning font-bold text-warning-ink'
                      : 'bg-muted text-info'
              } ${day.isToday ? 'ring-2 ring-inset ring-primary' : ''}`}
            >
              {day.date.getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- CalendarMonth.test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CalendarMonth.tsx apps/web/src/components/CalendarMonth.test.tsx
git commit -m "feat(web): migrate CalendarMonth to 3-state dateRanges prop"
```

---

### Task 9: Create the `PageHeader` component

**Files:**
- Create: `apps/web/src/components/PageHeader.tsx`
- Test: `apps/web/src/components/PageHeader.test.tsx`

**Interfaces:**
- Produces: `PageHeader({ title: string, subtitle: string, action?: ReactNode })`. Consumed by Tasks 12, 13, 14, 15, 16, 17.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/PageHeader.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title and subtitle', () => {
    render(<PageHeader title="My items" subtitle="3 active · 1 inactive" />)
    expect(screen.getByRole('heading', { name: 'My items' })).toBeInTheDocument()
    expect(screen.getByText('3 active · 1 inactive')).toBeInTheDocument()
  })

  it('renders the action node when provided', () => {
    render(<PageHeader title="My items" subtitle="x" action={<button>+ Publish item</button>} />)
    expect(screen.getByRole('button', { name: '+ Publish item' })).toBeInTheDocument()
  })

  it('has a full-bleed white background', () => {
    const { container } = render(<PageHeader title="X" subtitle="Y" />)
    expect(container.firstChild).toHaveClass('bg-card')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- PageHeader.test`
Expected: FAIL — `Cannot find module './PageHeader'`.

- [ ] **Step 3: Create `apps/web/src/components/PageHeader.tsx`**

```tsx
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-four py-three">
      <div>
        <h1 className="font-display text-lg font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- PageHeader.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/PageHeader.tsx apps/web/src/components/PageHeader.test.tsx
git commit -m "feat(web): add PageHeader component"
```

---

### Task 10: Update `ItemCard` (reactivate, plain-text name, 3-state strip, calendar link)

**Files:**
- Modify: `apps/web/src/components/ItemCard.tsx`
- Modify: `apps/web/src/components/ItemCard.test.tsx`

**Interfaces:**
- Consumes: `getItemDateStates`/`getAvailabilityStrip` (Tasks 5, 7), `t.itemCard.reactivate` (Task 4).
- Produces: `ItemCard({ item, onEdit?, onDelete?, onReactivate?, readOnly? })` (adds `onReactivate`; item name is no longer a link; Calendar button targets `/requests/calendar?item={id}`). Consumed by Task 13 (`ItemsPage`) and Task 14 (`PublishItemPage`, `readOnly` mode).

- [ ] **Step 1: Write the failing test**

Replace `apps/web/src/components/ItemCard.test.tsx` entirely with:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemCard } from './ItemCard'

describe('ItemCard', () => {
  it('renders the item name, category label, and the 14-day availability strip for an active item', () => {
    const item = mockItems[0]
    render(
      <MemoryRouter>
        <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByText(item.name)).toBeInTheDocument()
    expect(screen.getByText('Tools')).toBeInTheDocument()
    expect(screen.getByText('Next 14 days')).toBeInTheDocument()
  })

  it('does not render the item name as a link', () => {
    const item = mockItems[0]
    render(
      <MemoryRouter>
        <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: item.name })).not.toBeInTheDocument()
  })

  it('links the Calendar button to the calendar page with the item preselected', () => {
    const item = mockItems[0]
    render(
      <MemoryRouter>
        <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute(
      'href',
      `/requests/calendar?item=${item.id}`,
    )
  })

  it('calls onEdit and onDelete when their buttons are clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const item = mockItems[0]
    render(
      <MemoryRouter>
        <ItemCard item={item} onEdit={onEdit} onDelete={onDelete} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(item)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(item)
  })

  it('shows Reactivate and Edit only for an inactive item', async () => {
    const user = userEvent.setup()
    const onReactivate = vi.fn()
    const item = mockItems.find((i) => !i.is_active)!
    render(
      <MemoryRouter>
        <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} onReactivate={onReactivate} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Inactive · not visible in search')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    expect(onReactivate).toHaveBeenCalledWith(item)
  })

  it('hides all action buttons when readOnly', () => {
    render(
      <MemoryRouter>
        <ItemCard item={mockItems[0]} readOnly />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- ItemCard.test`
Expected: FAIL — item name is still a link, Calendar still points at `/items/{id}`, no `onReactivate`/Reactivate button exists.

- [ ] **Step 3: Replace `apps/web/src/components/ItemCard.tsx`**

```tsx
import { Link } from 'react-router-dom'
import type { Item } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { getAvailabilityStrip, getItemDateStates } from '@/lib/availability'
import { useTranslation } from '@/lib/i18n'
import { mockRequests } from '@/lib/mockData'
import { Button } from '@/components/ui/button'

interface ItemCardProps {
  item: Item
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  onReactivate?: (item: Item) => void
  readOnly?: boolean
}

export function ItemCard({ item, onEdit, onDelete, onReactivate, readOnly = false }: ItemCardProps) {
  const t = useTranslation()
  const dateRanges = getItemDateStates(item.id, mockRequests)
  const strip = getAvailabilityStrip(dateRanges)

  return (
    <div data-testid={`item-card-${item.id}`} className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-secondary to-card">
        <span className="absolute left-two top-two rounded-full bg-foreground/75 px-two py-half text-xs font-semibold capitalize text-card">
          {t.categories[item.category]}
        </span>
      </div>
      <div className="space-y-two p-three">
        <div className="flex items-start justify-between gap-two">
          <span className="font-semibold text-foreground">{item.name}</span>
          <span className="whitespace-nowrap font-mono text-sm font-semibold text-secondary-foreground">
            {formatCentavos(item.price_per_day)}
            <span className="text-xs font-normal text-muted-foreground">{t.itemCard.perDay}</span>
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        {item.is_active ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.itemCard.next14Days}</p>
            <div className="mt-one flex gap-half">
              {strip.map((day, index) => (
                <div
                  key={index}
                  className={`h-4 flex-1 rounded-sm ${
                    day === 'reserved' ? 'bg-destructive/65' : day === 'pending' ? 'bg-warning/65' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">{t.itemCard.inactive}</p>
        )}
        {!readOnly && item.is_active && (
          <div className="flex gap-two pt-one">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit?.(item)}>
              {t.itemCard.edit}
            </Button>
            <Button size="sm" variant="outline" className="flex-1" asChild>
              <Link to={`/requests/calendar?item=${item.id}`}>{t.itemCard.calendar}</Link>
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => onDelete?.(item)}>
              {t.itemCard.delete}
            </Button>
          </div>
        )}
        {!readOnly && !item.is_active && (
          <div className="flex gap-two pt-one">
            <Button size="sm" className="flex-1" onClick={() => onReactivate?.(item)}>
              {t.itemCard.reactivate}
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit?.(item)}>
              {t.itemCard.edit}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- ItemCard.test`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ItemCard.tsx apps/web/src/components/ItemCard.test.tsx
git commit -m "feat(web): add reactivate flow, drop name link, 3-state strip on ItemCard"
```

---

### Task 11: Update `DashboardLayout` (padding, sidebar resize, icons, Calendar nav, widget, badge fix)

**Files:**
- Modify: `apps/web/src/layouts/DashboardLayout.tsx`
- Modify: `apps/web/src/layouts/DashboardLayout.test.tsx`

**Interfaces:**
- Consumes: `getInitials` (Task 2), `t.nav.calendar`/`earnedThisMonth`/`vsLastMonth` (Task 4), `mockEarnings.by_month` (Task 3), `bg-sidebar-card` (Task 1).
- Produces: `<main>` with no padding (pages own their own via `PageHeader` + body wrapper, Task 9 onward).

- [ ] **Step 1: Write the failing test**

Replace `apps/web/src/layouts/DashboardLayout.test.tsx` entirely with:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { DashboardLayout } from './DashboardLayout'

function renderLayout() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<div>Home content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('DashboardLayout', () => {
  it('renders nav links for every top-level dashboard section, including Calendar', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'My items' })).toHaveAttribute('href', '/items')
    expect(screen.getByRole('link', { name: 'Publish item' })).toHaveAttribute('href', '/items/publish')
    expect(screen.getByRole('link', { name: /^Requests/ })).toHaveAttribute('href', '/requests')
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute('href', '/requests/calendar')
    expect(screen.getByRole('link', { name: 'Earnings' })).toHaveAttribute('href', '/earnings')
    expect(screen.getByText('Home content')).toBeInTheDocument()
  })

  it('shows a centered pending-request count badge on the Requests link', () => {
    renderLayout()
    const requestsLink = screen.getByRole('link', { name: /^Requests/ })
    expect(requestsLink).toHaveTextContent(/\d+/)
    const badge = requestsLink.querySelector('span')!
    expect(badge).toHaveClass('h-6', 'w-6', 'flex', 'items-center', 'justify-center')
  })

  it('shows the earned-this-month widget above the user footer', () => {
    renderLayout()
    const currentMonth = mockEarnings.by_month[mockEarnings.by_month.length - 1]
    expect(screen.getByText(formatCentavos(currentMonth.total))).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- DashboardLayout.test`
Expected: FAIL — no Calendar link, badge lacks `h-6`/`flex`/`items-center`/`justify-center`, no earned-this-month widget.

- [ ] **Step 3: Replace `apps/web/src/layouts/DashboardLayout.tsx`**

```tsx
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Calendar, DollarSign, LayoutGrid, MessageSquare, Package, Plus } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useTranslation } from '@/lib/i18n'
import { formatCentavos, getInitials } from '@/lib/format'
import { mockEarnings, mockRequests, mockUser } from '@/lib/mockData'
import { Button } from '@/components/ui/button'

export function DashboardLayout() {
  const { logout } = useAuth()
  const location = useLocation()
  const t = useTranslation()
  const pendingCount = mockRequests.filter((r) => r.status === 'requested').length
  const months = mockEarnings.by_month
  const currentMonth = months[months.length - 1]
  const previousMonth = months[months.length - 2]
  const deltaPct = Math.round(((currentMonth.total - previousMonth.total) / previousMonth.total) * 100)

  const navGroups = [
    { label: t.nav.groupPanel, items: [{ to: '/dashboard', label: t.nav.overview, icon: LayoutGrid }] },
    {
      label: t.nav.groupInventory,
      items: [
        { to: '/items', label: t.nav.myItems, icon: Package },
        { to: '/items/publish', label: t.nav.publishItem, icon: Plus },
      ],
    },
    {
      label: t.nav.groupActivity,
      items: [
        { to: '/requests', label: t.nav.requests, icon: MessageSquare },
        { to: '/requests/calendar', label: t.nav.calendar, icon: Calendar },
      ],
    },
    { label: t.nav.groupFinance, items: [{ to: '/earnings', label: t.nav.earnings, icon: DollarSign }] },
  ]

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-72 flex-shrink-0 flex-col bg-sidebar p-four text-sidebar-foreground">
        <div className="mb-five flex items-center gap-two px-one">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary-foreground font-display text-base font-bold text-primary-foreground">
            R
          </div>
          <span className="font-display text-base font-semibold text-white">RentaTodo</span>
        </div>

        <nav className="flex-1 space-y-four">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-two pb-one text-[10.5px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                {group.label}
              </div>
              <div className="space-y-half">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.to
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-two rounded-md px-two py-two text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {item.label}
                      {item.to === '/requests' && pendingCount > 0 && (
                        <span className="ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-warning-ink">
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-four rounded-lg bg-sidebar-card p-three">
          <p className="text-xs font-medium uppercase tracking-wide text-sidebar-foreground/60">{t.nav.earnedThisMonth}</p>
          <p className="mt-half font-display text-xl font-semibold text-white">{formatCentavos(currentMonth.total)}</p>
          <p className="mt-half text-xs text-on-dark-accent">
            ↑ {deltaPct}% {t.nav.vsLastMonth}
          </p>
        </div>

        <div className="mt-four flex items-center gap-two border-t border-sidebar-border pt-three">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-warning-ink">
            {getInitials(mockUser.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{mockUser.name}</div>
            <div className="text-xs text-sidebar-foreground/60">{t.nav.ownerRole}</div>
          </div>
        </div>
        <Button variant="outline" className="mt-three" onClick={logout}>
          {t.nav.logOut}
        </Button>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- DashboardLayout.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/layouts/DashboardLayout.tsx apps/web/src/layouts/DashboardLayout.test.tsx
git commit -m "feat(web): resize sidebar, add nav icons/Calendar entry/earnings widget, fix badge centering"
```

---

### Task 12: Migrate `DashboardPage` to `PageHeader`

**Files:**
- Modify: `apps/web/src/routes/DashboardPage.tsx`
- Modify: `apps/web/src/routes/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 9).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/routes/DashboardPage.test.tsx`, inside the existing `describe('DashboardPage', ...)` block:

```tsx
  it('renders the page header with the title and welcome message', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText('Welcome back, María')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- DashboardPage.test`
Expected: FAIL — no `role="heading"` element exists yet (the current `<h1>` isn't inside a `PageHeader`, but wait — it already IS an `<h1>`, so this specific assertion might actually pass already. The real failure signal is structural: proceed to Step 3 regardless, since the goal is consistency with every other page, not fixing a literal failure).

- [ ] **Step 3: Update `apps/web/src/routes/DashboardPage.tsx`**

Add the import:

```ts
import { PageHeader } from '@/components/PageHeader'
```

Replace the opening `<div className="space-y-four">` block's header portion — everything from `<div className="flex items-center justify-between">` through its closing `</div>` — with:

```tsx
      <PageHeader
        title={t.dashboard.title}
        subtitle={t.dashboard.welcomeBack(mockUser.name.split(' ')[0])}
        action={
          <Button asChild>
            <Link to="/items/publish">{t.dashboard.publishItem}</Link>
          </Button>
        }
      />
```

Wrap the rest of the existing body (the KPI grid `<div>` and the recent-requests `<div>`) in a new `<div className="p-four space-y-four">`, and change the outer wrapping `<div className="space-y-four">` to plain `<div>` (the `space-y-four` moves to the new inner wrapper). The full return becomes:

```tsx
  return (
    <div>
      <PageHeader
        title={t.dashboard.title}
        subtitle={t.dashboard.welcomeBack(mockUser.name.split(' ')[0])}
        action={
          <Button asChild>
            <Link to="/items/publish">{t.dashboard.publishItem}</Link>
          </Button>
        }
      />
      <div className="p-four space-y-four">
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
                  <Button size="sm" variant="outline" onClick={() => setStatus(reservation.id, 'rejected')}>
                    {t.dashboard.reject}
                  </Button>
                  <Button size="sm" onClick={() => setStatus(reservation.id, 'approved')}>
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
```

(The component's top — imports, `useState`/derived-value logic before `return` — is unchanged.)

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- DashboardPage.test`
Expected: PASS (4 tests — the 3 existing ones still pass since the KPI/recent-requests markup is unchanged, plus the new header test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/DashboardPage.tsx apps/web/src/routes/DashboardPage.test.tsx
git commit -m "feat(web): migrate DashboardPage to PageHeader"
```

---

### Task 13: Rebuild `ItemsPage` as a card grid with search

**Files:**
- Modify: `apps/web/src/routes/ItemsPage.tsx`
- Modify: `apps/web/src/routes/ItemsPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 9), `ItemCard` with `onReactivate` (Task 10), `t.items.*` (Task 4).
- Produces: same `ItemsPage` export (no props — it's a route component). Create-item Dialog trigger is removed (create now lives at `/items/publish`, Task 14); the pre-filled edit Dialog stays.

- [ ] **Step 1: Write the failing test**

Replace `apps/web/src/routes/ItemsPage.test.tsx` entirely with:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemsPage } from './ItemsPage'

describe('ItemsPage', () => {
  it('renders a card for every mock item with an active/inactive count in the header', () => {
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    for (const item of mockItems) {
      expect(screen.getByText(item.name)).toBeInTheDocument()
    }
    const activeCount = mockItems.filter((i) => i.is_active).length
    const inactiveCount = mockItems.length - activeCount
    expect(screen.getByText(`${activeCount} active · ${inactiveCount} inactive`)).toBeInTheDocument()
  })

  it('filters items by name as the user types in the search box', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    const searchTerm = mockItems[0].name.split(' ')[0]
    await user.type(screen.getByRole('textbox'), searchTerm)
    expect(screen.getByText(mockItems[0].name)).toBeInTheDocument()
    for (const other of mockItems.slice(1)) {
      if (!other.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        expect(screen.queryByText(other.name)).not.toBeInTheDocument()
      }
    }
  })

  it('reactivates an inactive item when its Reactivate button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })

  it('edits an existing item through the pre-filled dialog', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    const item = mockItems[0]
    const card = screen.getByTestId(`item-card-${item.id}`)
    await user.click(within(card).getByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    expect(nameInput.value).toBe(item.name)
    await user.clear(nameInput)
    await user.type(nameInput, `${item.name} (renovated)`)
    await user.click(screen.getByRole('button', { name: 'Save item' }))
    expect(screen.getByText(`${item.name} (renovated)`)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- ItemsPage.test`
Expected: FAIL — no search box, no active/inactive count subtitle, no Reactivate button yet on the page level.

- [ ] **Step 3: Replace `apps/web/src/routes/ItemsPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { ItemCard } from '@/components/ItemCard'
import { mockItems } from '@/lib/mockData'
import type { Category, Item } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES: Category[] = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home', 'other']

const BLANK_FORM = { name: '', description: '', category: CATEGORIES[0], priceDollars: '', photoUrl: '' }

export function ItemsPage() {
  const t = useTranslation()
  const [items, setItems] = useState<Item[]>(mockItems)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [query, setQuery] = useState('')

  const activeCount = items.filter((i) => i.is_active).length
  const inactiveCount = items.length - activeCount

  const filteredItems = items.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return item.name.toLowerCase().includes(q) || t.categories[item.category].toLowerCase().includes(q)
  })

  function openEditDialog(item: Item) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description,
      category: item.category,
      priceDollars: String(item.price_per_day / 100),
      photoUrl: item.photo_url,
    })
    setOpen(true)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const priceCentavos = Math.round(Number(form.priceDollars) * 100)
    if (editingId) {
      setItems((current) =>
        current.map((item) =>
          item.id === editingId
            ? {
                ...item,
                name: form.name,
                description: form.description,
                category: form.category,
                price_per_day: priceCentavos,
                photo_url: form.photoUrl,
              }
            : item,
        ),
      )
    }
    setOpen(false)
    setEditingId(null)
    setForm(BLANK_FORM)
  }

  function handleDelete(item: Item) {
    // Phase 1: no real DELETE /items/{id} call yet — mirrors the API's soft
    // delete (is_active: false), never removes the row.
    const confirmed = window.confirm(`Delete "${item.name}"? It will stop appearing in public search.`)
    if (!confirmed) return
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, is_active: false } : i)))
  }

  function handleReactivate(item: Item) {
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, is_active: true } : i)))
  }

  return (
    <div>
      <PageHeader
        title={t.items.title}
        subtitle={t.items.subtitle(activeCount, inactiveCount)}
        action={
          <Button asChild>
            <Link to="/items/publish">{t.dashboard.publishItem}</Link>
          </Button>
        }
      />
      <div className="space-y-three p-four">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.items.searchPlaceholder}
          aria-label={t.items.searchPlaceholder}
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-two">
              <div className="space-y-half">
                <Label htmlFor="item-name">Name</Label>
                <Input id="item-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-half">
                <Label htmlFor="item-description">Description</Label>
                <Input
                  id="item-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-half">
                <Label htmlFor="item-category">Category</Label>
                <select
                  id="item-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
                  className="w-full rounded-md border border-input bg-card px-two py-half text-foreground"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t.categories[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-half">
                <Label htmlFor="item-price">Price per day (USD)</Label>
                <Input
                  id="item-price"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.priceDollars}
                  onChange={(e) => setForm((f) => ({ ...f, priceDollars: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-half">
                <Label htmlFor="item-photo">Photo URL</Label>
                <Input
                  id="item-photo"
                  type="url"
                  value={form.photoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Save item
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-4 gap-three">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} onEdit={openEditDialog} onDelete={handleDelete} onReactivate={handleReactivate} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- ItemsPage.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/ItemsPage.tsx apps/web/src/routes/ItemsPage.test.tsx
git commit -m "feat(web): rebuild ItemsPage as a searchable card grid, move create to its own page"
```

---

### Task 14: Create `PublishItemPage`

**Files:**
- Create: `apps/web/src/routes/PublishItemPage.tsx`
- Test: `apps/web/src/routes/PublishItemPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 9), `ItemCard` `readOnly` mode (Task 10), `t.publish.*` (Task 4).
- Produces: `PublishItemPage` route component, registered at `/items/publish` in Task 19.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/PublishItemPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PublishItemPage } from './PublishItemPage'

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/items/publish']}>
      <Routes>
        <Route path="/items/publish" element={<PublishItemPage />} />
        <Route path="/items" element={<div>Items page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublishItemPage', () => {
  it('reflects the typed name in the live preview', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Taladro Bosch Professional')
    expect(screen.getAllByText('Taladro Bosch Professional')).toHaveLength(1)
  })

  it('navigates to /items on submit', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Taladro Bosch Professional')
    await user.type(screen.getByLabelText('Price per day (USD)'), '10')
    await user.type(screen.getByLabelText('Description'), 'A description')
    await user.type(screen.getByLabelText('Photo'), 'https://example.com/photo.jpg')
    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    expect(screen.getByText('Items page')).toBeInTheDocument()
  })

  it('navigates to /items on cancel without submitting', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Items page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- PublishItemPage.test`
Expected: FAIL — `Cannot find module './PublishItemPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/PublishItemPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { ItemCard } from '@/components/ItemCard'
import { mockUser } from '@/lib/mockData'
import type { Category, Item } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES: Category[] = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home', 'other']

export function PublishItemPage() {
  const t = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>(CATEGORIES[0])
  const [priceDollars, setPriceDollars] = useState('')
  const [description, setDescription] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  const previewItem: Item = {
    id: 'preview',
    name: name || t.publish.previewEmptyName,
    description: description || t.publish.previewEmptyDescription,
    category,
    price_per_day: Math.round(Number(priceDollars || '0') * 100),
    photo_url: photoUrl,
    is_active: true,
    owner_id: mockUser.id,
    owner_name: mockUser.name,
    created_at: new Date().toISOString(),
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Phase 1: no real POST /items call yet — mirrors the rest of the app's
    // mock-data-only behavior, just navigates back.
    navigate('/items')
  }

  function handleCancel() {
    navigate('/items')
  }

  return (
    <div>
      <PageHeader title={t.publish.title} subtitle={t.publish.subtitle} />
      <div className="grid grid-cols-2 gap-four p-four">
        <form onSubmit={handleSubmit} className="space-y-three rounded-lg border border-border bg-card p-four">
          <div className="space-y-half">
            <Label htmlFor="publish-name">{t.publish.name}</Label>
            <Input id="publish-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-half">
            <Label>{t.publish.category}</Label>
            <div className="flex flex-wrap gap-half">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-two py-half text-sm font-medium ${
                    category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t.categories[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-half">
            <Label htmlFor="publish-price">{t.publish.price}</Label>
            <Input
              id="publish-price"
              type="number"
              min={0.01}
              step={0.01}
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              required
            />
          </div>
          <div className="space-y-half">
            <Label htmlFor="publish-description">{t.publish.description}</Label>
            <textarea
              id="publish-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-card px-two py-half text-foreground"
            />
          </div>
          <div className="space-y-half">
            <Label htmlFor="publish-photo">{t.publish.photo}</Label>
            <Input id="publish-photo" type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} required />
          </div>
          <div className="flex gap-two">
            <Button type="submit" className="flex-1">
              {t.publish.submit}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
              {t.publish.cancel}
            </Button>
          </div>
        </form>

        <div>
          <p className="mb-two text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.publish.previewTitle}</p>
          <ItemCard item={previewItem} readOnly />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- PublishItemPage.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/PublishItemPage.tsx apps/web/src/routes/PublishItemPage.test.tsx
git commit -m "feat(web): add PublishItemPage with live preview"
```

---

### Task 15: Rebuild `RequestsPage` (tabs, search, card rows)

**Files:**
- Modify: `apps/web/src/routes/RequestsPage.tsx`
- Modify: `apps/web/src/routes/RequestsPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 9), `getInitials` (Task 2), `t.requests.*` (Task 4), `StatusBadge` (already exists).

- [ ] **Step 1: Write the failing test**

Replace `apps/web/src/routes/RequestsPage.test.tsx` entirely with:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockRequests } from '@/lib/mockData'
import { RequestsPage } from './RequestsPage'

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/requests']}>
      <Routes>
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/reservations/:id" element={<div>Reservation detail</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequestsPage', () => {
  it('shows the Pending tab by default with only requested reservations', () => {
    renderPage()
    const pending = mockRequests.filter((r) => r.status === 'requested')
    for (const r of pending) {
      expect(screen.getByText(new RegExp(r.renter_name))).toBeInTheDocument()
    }
    const active = mockRequests.find((r) => r.status === 'delivered')!
    expect(screen.queryByText(new RegExp(active.renter_name))).not.toBeInTheDocument()
  })

  it('switches tabs and shows the right reservations for each bucket', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /History/ }))
    const closed = mockRequests.find((r) => r.status === 'closed')!
    expect(screen.getByText(new RegExp(closed.renter_name))).toBeInTheDocument()
  })

  it('filters the visible tab by renter name', async () => {
    const user = userEvent.setup()
    renderPage()
    const pending = mockRequests.find((r) => r.status === 'requested')!
    await user.type(screen.getByRole('textbox'), pending.renter_name)
    expect(screen.getByText(new RegExp(pending.renter_name))).toBeInTheDocument()
  })

  it('approves a pending request, removing it from the Pending tab', async () => {
    const user = userEvent.setup()
    renderPage()
    const pending = mockRequests.find((r) => r.status === 'requested')!
    const row = screen.getByText(new RegExp(pending.renter_name)).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Approve' }))
    expect(screen.queryByText(new RegExp(pending.renter_name))).not.toBeInTheDocument()
  })

  it('links each row to its reservation detail page', () => {
    renderPage()
    const pending = mockRequests.find((r) => r.status === 'requested')!
    expect(screen.getByRole('link', { name: new RegExp(pending.renter_name) })).toHaveAttribute(
      'href',
      `/reservations/${pending.id}`,
    )
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- RequestsPage.test`
Expected: FAIL — no tabs, no search box, still a `<table>` rather than card rows.

- [ ] **Step 3: Replace `apps/web/src/routes/RequestsPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { mockRequests } from '@/lib/mockData'
import type { Reservation, ReservationStatus } from '@/lib/types'
import { formatCentavos, getInitials } from '@/lib/format'
import { useTranslation } from '@/lib/i18n'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
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
  const [requests, setRequests] = useState<Reservation[]>(mockRequests)
  const [tab, setTab] = useState<Tab>('pending')
  const [query, setQuery] = useState('')

  function setStatus(id: string, status: Reservation['status']) {
    setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)))
  }

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

  return (
    <div>
      <PageHeader title={t.requests.title} subtitle={t.requests.subtitle} />
      <div className="space-y-three p-four">
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
                    <Button size="sm" variant="outline" onClick={() => setStatus(reservation.id, 'rejected')}>
                      {t.requests.reject}
                    </Button>
                    <Button size="sm" onClick={() => setStatus(reservation.id, 'approved')}>
                      {t.requests.approve}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- RequestsPage.test`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/RequestsPage.tsx apps/web/src/routes/RequestsPage.test.tsx
git commit -m "feat(web): rebuild RequestsPage with tabs, search, and card rows"
```

---

### Task 16: Create `CalendarPage`

**Files:**
- Create: `apps/web/src/routes/CalendarPage.tsx`
- Test: `apps/web/src/routes/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 9), `CalendarMonth` (Task 8), `getItemDateStates` (Task 5), `StatusBadge` (existing), `t.calendar.*` (Task 4).
- Produces: `CalendarPage` route component, registered at `/requests/calendar` in Task 19.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/CalendarPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems, mockRequests } from '@/lib/mockData'
import { CalendarPage } from './CalendarPage'

function renderPage(initialEntry = '/requests/calendar') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/requests/calendar" element={<CalendarPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CalendarPage', () => {
  it('defaults to the first item when no item is preselected', () => {
    renderPage()
    expect(screen.getByRole('combobox')).toHaveValue(mockItems[0].id)
  })

  it('preselects the item from the ?item= query param', () => {
    renderPage(`/requests/calendar?item=${mockItems[1].id}`)
    expect(screen.getByRole('combobox')).toHaveValue(mockItems[1].id)
  })

  it('switches items when a different one is picked from the dropdown', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.selectOptions(screen.getByRole('combobox'), mockItems[1].id)
    expect(screen.getByRole('combobox')).toHaveValue(mockItems[1].id)
  })

  it("lists this item's reservations below the calendar", () => {
    renderPage()
    const reservation = mockRequests.find((r) => r.item_id === mockItems[0].id)!
    expect(screen.getByText(new RegExp(reservation.renter_name))).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- CalendarPage.test`
Expected: FAIL — `Cannot find module './CalendarPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/CalendarPage.tsx`**

```tsx
import { useMemo, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { CalendarMonth } from '@/components/CalendarMonth'
import { StatusBadge } from '@/components/StatusBadge'
import { getItemDateStates } from '@/lib/availability'
import { mockItems, mockRequests } from '@/lib/mockData'
import { useTranslation } from '@/lib/i18n'

export function CalendarPage() {
  const t = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedId = searchParams.get('item')
  const selectedItem = mockItems.find((i) => i.id === requestedId) ?? mockItems[0]

  const dateRanges = useMemo(() => getItemDateStates(selectedItem.id, mockRequests), [selectedItem.id])
  const itemReservations = useMemo(() => mockRequests.filter((r) => r.item_id === selectedItem.id), [selectedItem.id])

  const now = new Date()
  const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const secondMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  function handleSelect(event: ChangeEvent<HTMLSelectElement>) {
    setSearchParams({ item: event.target.value })
  }

  return (
    <div>
      <PageHeader
        title={t.calendar.title}
        subtitle={t.calendar.subtitle}
        action={
          <select
            value={selectedItem.id}
            onChange={handleSelect}
            aria-label={t.calendar.title}
            className="rounded-md border border-input bg-card px-two py-half text-foreground"
          >
            {mockItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        }
      />
      <div className="space-y-four p-four">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-foreground">{selectedItem.name}</h2>
          <div className="flex gap-three text-xs text-muted-foreground">
            <span className="flex items-center gap-half">
              <span className="h-2 w-2 rounded-sm bg-muted" />
              {t.calendar.legend.available}
            </span>
            <span className="flex items-center gap-half">
              <span className="h-2 w-2 rounded-sm bg-warning" />
              {t.calendar.legend.pending}
            </span>
            <span className="flex items-center gap-half">
              <span className="h-2 w-2 rounded-sm bg-destructive" />
              {t.calendar.legend.reserved}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-four rounded-lg border border-border bg-card p-four">
          <CalendarMonth monthStart={firstMonth} dateRanges={dateRanges} />
          <CalendarMonth monthStart={secondMonth} dateRanges={dateRanges} />
        </div>

        <div>
          <h2 className="mb-two font-medium text-foreground">{t.calendar.reservationsHeading}</h2>
          <ul className="space-y-two">
            {itemReservations.map((reservation) => (
              <li key={reservation.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-three">
                <Link to={`/reservations/${reservation.id}`} className="hover:text-primary">
                  {reservation.renter_name} · {reservation.start_date} — {reservation.end_date}
                </Link>
                <StatusBadge status={reservation.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- CalendarPage.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/CalendarPage.tsx apps/web/src/routes/CalendarPage.test.tsx
git commit -m "feat(web): add CalendarPage with item picker and 3-state grid"
```

---

### Task 17: Rebuild `EarningsPage` (KPIs, bar chart, by-item selection)

**Files:**
- Modify: `apps/web/src/routes/EarningsPage.tsx`
- Modify: `apps/web/src/routes/EarningsPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 9), `mockEarnings.by_month` (Task 3), `t.earnings.*` (Task 4).

- [ ] **Step 1: Write the failing test**

Replace `apps/web/src/routes/EarningsPage.test.tsx` entirely with:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { EarningsPage } from './EarningsPage'

describe('EarningsPage', () => {
  it('renders the 3 KPI cards derived from mock data', () => {
    render(<EarningsPage />)
    expect(screen.getByText(formatCentavos(mockEarnings.total_earnings))).toBeInTheDocument()
    const currentMonth = mockEarnings.by_month[mockEarnings.by_month.length - 1]
    expect(screen.getByText(formatCentavos(currentMonth.total))).toBeInTheDocument()
  })

  it('renders one bar per month in the chart', () => {
    render(<EarningsPage />)
    for (const entry of mockEarnings.by_month) {
      expect(screen.getByText(entry.month)).toBeInTheDocument()
    }
  })

  it('selects the first item by default and updates the breakdown when another item is clicked', async () => {
    const user = userEvent.setup()
    render(<EarningsPage />)
    const first = mockEarnings.by_item[0]
    const second = mockEarnings.by_item[1]

    const firstPanel = screen.getByText(first.item_name, { selector: 'h2' }).closest('div')!
    expect(within(firstPanel).getByText(`${first.rentals[0].start_date} - ${first.rentals[0].end_date}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: new RegExp(second.item_name) }))
    expect(screen.getByText(second.item_name, { selector: 'h2' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- EarningsPage.test`
Expected: FAIL — no monthly bar chart, no "This month" KPI, no selectable item rows in this shape.

- [ ] **Step 3: Replace `apps/web/src/routes/EarningsPage.tsx`**

```tsx
import { useState } from 'react'
import { mockEarnings, mockRequests } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { useTranslation } from '@/lib/i18n'
import { PageHeader } from '@/components/PageHeader'

export function EarningsPage() {
  const t = useTranslation()
  const [selectedItemId, setSelectedItemId] = useState(mockEarnings.by_item[0]?.item_id)
  const selected = mockEarnings.by_item.find((i) => i.item_id === selectedItemId)
  const closedCount = mockRequests.filter((r) => r.status === 'closed').length
  const currentMonth = mockEarnings.by_month[mockEarnings.by_month.length - 1]
  const maxMonth = Math.max(...mockEarnings.by_month.map((m) => m.total))
  const maxItem = Math.max(...mockEarnings.by_item.map((i) => i.total))

  return (
    <div>
      <PageHeader title={t.earnings.title} subtitle={t.earnings.subtitle} />
      <div className="space-y-four p-four">
        <div className="grid grid-cols-3 gap-three">
          <div className="rounded-lg border border-sidebar-border bg-sidebar p-three">
            <p className="text-xs font-medium text-sidebar-foreground/70">{t.earnings.kpiTotal}</p>
            <p className="font-display text-2xl font-semibold text-white">{formatCentavos(mockEarnings.total_earnings)}</p>
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
            {mockEarnings.by_month.map((entry, index) => {
              const isCurrent = index === mockEarnings.by_month.length - 1
              const heightPct = (entry.total / maxMonth) * 100
              return (
                <div key={entry.month} className="flex flex-1 flex-col items-center gap-half">
                  <span className="text-xs font-semibold text-foreground">{formatCentavos(entry.total)}</span>
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
              {mockEarnings.by_item.map((byItem) => (
                <li key={byItem.item_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(byItem.item_id)}
                    aria-pressed={selectedItemId === byItem.item_id}
                    className={`w-full rounded-lg border p-three text-left ${
                      selectedItemId === byItem.item_id ? 'border-primary' : 'border-border'
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

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- EarningsPage.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/EarningsPage.tsx apps/web/src/routes/EarningsPage.test.tsx
git commit -m "feat(web): rebuild EarningsPage with KPIs, monthly chart, and item selection"
```

---

### Task 18: Remove `ItemDetailPage` and the now-dead `ItemDetail`/`UnavailableRange`/`mockItemDetail`

**Files:**
- Delete: `apps/web/src/routes/ItemDetailPage.tsx`
- Delete: `apps/web/src/routes/ItemDetailPage.test.tsx`
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/mockData.ts`
- Modify: `apps/web/src/lib/mockData.test.ts`

**Interfaces:**
- Removes: `ItemDetail`, `UnavailableRange` types; `mockItemDetail()` function. Confirmed unreferenced as of this task — every prior consumer (`ItemCard`, `CalendarMonth`, `availability.ts`, `calendar.ts`) was migrated off them in Tasks 5-10.

- [ ] **Step 1: Delete the item-detail page and its test**

```bash
rm apps/web/src/routes/ItemDetailPage.tsx apps/web/src/routes/ItemDetailPage.test.tsx
```

- [ ] **Step 2: Remove the dead test case from `apps/web/src/lib/mockData.test.ts`**

Delete this test (and its now-unused `mockItemDetail` import):

```ts
  it('mockItemDetail returns unavailable_dates for a known item id', () => {
    const detail = mockItemDetail(mockItems[0].id)
    expect(detail?.unavailable_dates.length).toBeGreaterThan(0)
  })
```

Update the import line from:
```ts
import { mockEarnings, mockItemDetail, mockItems, mockRequests, mockTransactions, mockUser } from './mockData'
```
to:
```ts
import { mockEarnings, mockItems, mockRequests, mockTransactions, mockUser } from './mockData'
```

- [ ] **Step 3: Remove `mockItemDetail` from `apps/web/src/lib/mockData.ts`**

Delete the entire `mockItemDetail` function:

```ts
export function mockItemDetail(itemId: string): ItemDetail | undefined {
  const item = mockItems.find((candidate) => candidate.id === itemId)
  if (!item) return undefined
  return {
    ...item,
    unavailable_dates: [
      { start_date: '2026-07-18', end_date: '2026-07-20' },
      { start_date: '2026-07-25', end_date: '2026-07-27' },
    ],
  }
}
```

Update the top-of-file type import to drop `ItemDetail`:

```ts
import type {
  Earnings,
  Item,
  Reservation,
  Transaction,
  User,
} from './types'
```

- [ ] **Step 4: Remove `ItemDetail` and `UnavailableRange` from `apps/web/src/lib/types.ts`**

Delete these two:

```ts
export interface UnavailableRange {
  start_date: string
  end_date: string
}

export interface ItemDetail extends Item {
  unavailable_dates: UnavailableRange[]
}
```

- [ ] **Step 5: Verify**

Run: `pnpm --filter @rentatodo/web test -- --run` then `pnpm --filter @rentatodo/web build`
Expected: all tests PASS, build exits 0 — confirms nothing still references the removed page/types/function. (`ItemsPage.test.tsx` no longer has a route to `/items/:id` to worry about — it never routed there directly in tests anyway, each page test uses its own isolated `MemoryRouter`.)

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/routes/ItemDetailPage.tsx apps/web/src/routes/ItemDetailPage.test.tsx apps/web/src/lib/types.ts apps/web/src/lib/mockData.ts apps/web/src/lib/mockData.test.ts
git commit -m "chore(web): remove ItemDetailPage and the dead ItemDetail/UnavailableRange/mockItemDetail"
```

---

### Task 19: Wire the router (`/items/publish`, `/requests/calendar`, remove `/items/:id`)

**Files:**
- Modify: `apps/web/src/routes/index.tsx`

**Interfaces:**
- Consumes: `PublishItemPage` (Task 14), `CalendarPage` (Task 16).

- [ ] **Step 1: Replace `apps/web/src/routes/index.tsx`**

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '@/components/RequireAuth'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'
import { DashboardPage } from './DashboardPage'
import { ItemsPage } from './ItemsPage'
import { PublishItemPage } from './PublishItemPage'
import { RequestsPage } from './RequestsPage'
import { CalendarPage } from './CalendarPage'
import { ReservationDetailPage } from './ReservationDetailPage'
import { EarningsPage } from './EarningsPage'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/items', element: <ItemsPage /> },
      { path: '/items/publish', element: <PublishItemPage /> },
      { path: '/requests', element: <RequestsPage /> },
      { path: '/requests/calendar', element: <CalendarPage /> },
      { path: '/reservations/:id', element: <ReservationDetailPage /> },
      { path: '/earnings', element: <EarningsPage /> },
    ],
  },
])
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @rentatodo/web test -- --run` then `pnpm --filter @rentatodo/web build`
Expected: all tests PASS, build exits 0 — this is the final integration point; every page built in this plan is now actually reachable.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/index.tsx
git commit -m "feat(web): wire /items/publish and /requests/calendar routes, remove /items/:id"
```

---

## Closing Note

After this plan lands, `ReservationDetailPage` is the only Phase-1 page still untouched by any mockup-driven restyle (it's out of scope per the revision-3 addendum — no mockup was provided for it) and still uses hardcoded English string literals instead of the i18n dictionary. It stays fully functional and reachable (from Requests and Calendar rows) throughout this plan. A future pass can restyle/i18n-wire it if Silverk sends a mockup for it.
