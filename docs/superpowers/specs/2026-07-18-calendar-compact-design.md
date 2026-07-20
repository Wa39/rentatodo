# Compact Calendar + Today Indicator — Design

## What this is

Two small visual fixes to the owner's `/requests/calendar` page:

1. The two-month calendar grid currently stretches to fill the full page
   width, making each day cell oversized. It should render at a compact,
   date-picker-like size instead.
2. There's an existing "today" indicator (a `ring-2 ring-inset ring-primary`
   around the day number), but it's too subtle to notice in practice. It's
   replaced with a small colored dot under the day number.

No data or logic changes — `getMonthGridDays`'s existing `CalendarDay.isToday`
field (in `apps/web/src/lib/calendar.ts`) is reused as-is. This is a styling
change to `CalendarMonth.tsx` and a layout change to `CalendarPage.tsx`.

## Current state

`apps/web/src/routes/CalendarPage.tsx` renders both months in:

```tsx
<div className="grid grid-cols-2 gap-four rounded-lg border border-border bg-card p-four">
  <CalendarMonth monthStart={firstMonth} dateRanges={dateRanges} />
  <CalendarMonth monthStart={secondMonth} dateRanges={dateRanges} />
</div>
```

`grid-cols-2` uses `1fr 1fr` tracks, which stretch to fill the parent's full
width — on a typical dashboard viewport this means each day cell (7 columns,
`aspect-square`) ends up 60-80px per side.

`apps/web/src/components/CalendarMonth.tsx`'s day cell today-marker:

```tsx
} ${day.isToday ? 'ring-2 ring-inset ring-primary' : ''}`}
```

## Changes

### 1. Compact, fixed-width calendar grid

Replace the container's grid definition so each month renders at a fixed
~280px instead of stretching, and the container sizes to its content
instead of the page width:

```tsx
<div className="flex w-fit gap-four rounded-lg border border-border bg-card p-four">
  <div className="w-[280px]">
    <CalendarMonth monthStart={firstMonth} dateRanges={dateRanges} />
  </div>
  <div className="w-[280px]">
    <CalendarMonth monthStart={secondMonth} dateRanges={dateRanges} />
  </div>
</div>
```

`flex w-fit` instead of `grid grid-cols-2`: a flex container with `w-fit`
sizes itself to its children's content instead of stretching to the parent's
full width, which is what actually shrinks the visible box — a grid with
fixed-px tracks would still be a block element that stretches to 100% of its
parent by default. Each child wrapper pins its `CalendarMonth` to exactly
280px so cell size is now driven by a fixed 280px / 7 columns, not the
viewport.

This is a page-layout change only — `CalendarMonth.tsx`'s own markup doesn't
need a width prop; it already fills whatever width its parent gives it
(`grid grid-cols-7` inside a 280px box naturally produces ~40px cells).

### 2. Today indicator: dot instead of ring

In `apps/web/src/components/CalendarMonth.tsx`, the day cell wrapper gets
`relative` (so the dot can be absolutely positioned within it), and the
today-only ring class is replaced with a dot rendered as a sibling `<span>`:

```tsx
return (
  <div
    key={dateStr}
    className={`relative flex aspect-square items-center justify-center rounded-md text-sm font-medium ${
      !day.inCurrentMonth
        ? 'text-muted-foreground opacity-30'
        : state === 'reserved'
          ? 'bg-destructive font-bold text-destructive-foreground'
          : state === 'pending'
            ? 'bg-warning font-bold text-warning-ink'
            : 'bg-muted text-info'
    }`}
  >
    {day.date.getDate()}
    {day.isToday && (
      <span
        data-testid="today-dot"
        aria-hidden="true"
        className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background"
      />
    )}
  </div>
)
```

- `bg-primary` — the brand forest green (`#1E7A4F`), distinct from the three
  state colors already in use (destructive red, warning amber, muted gray),
  so it reads as "a marker," not another status.
- `ring-2 ring-background` around the dot itself — a thin border in the
  page's background color, so the dot stays visually separated from
  whatever the cell's own background is (muted gray, destructive red, or
  warning amber), instead of blending into it.
- `aria-hidden="true"` — the dot is decorative; the day number itself is
  already the accessible content. No screen-reader announcement needed for
  "this is today" in this internal owner-dashboard context (matches the
  existing pattern: none of `CalendarMonth`'s current day-state styling has
  its own ARIA label either).

### 3. Test update

`apps/web/src/components/CalendarMonth.test.tsx` currently asserts:

```tsx
expect(screen.getByText('14')).toHaveClass('ring-primary')
expect(screen.getByText('13')).not.toHaveClass('ring-primary')
```

These change to check for the dot instead — since the dot is a separate
sibling element (`data-testid="today-dot"`), not a class on the day-number
text node, the test queries via the day cell's container using `within`
(the same pattern already used elsewhere in this codebase, e.g.
`ItemsPage.test.tsx`, `DashboardPage.test.tsx`):

```tsx
const todayCell = screen.getByText('14').closest('div')!
expect(within(todayCell).getByTestId('today-dot')).toBeInTheDocument()

const otherCell = screen.getByText('13').closest('div')!
expect(within(otherCell).queryByTestId('today-dot')).not.toBeInTheDocument()
```

(`within` needs adding to the existing `@testing-library/react` import in
`CalendarMonth.test.tsx`.)

No other test file references the ring or today-styling — confirmed by
grepping `ring-primary` and `isToday` across `apps/web/src` (only
`CalendarMonth.tsx`/`.test.tsx` and `calendar.ts`/`.test.ts` reference
either).

## Explicitly out of scope

- No change to `CalendarPage.tsx`'s reservation-list section below the
  calendars, or to the legend/status-color system.
- No change to `getMonthGridDays`/`isToday`'s computation — only how the
  result is styled.
- No responsive/mobile breakpoint handling beyond what already exists — the
  fixed 280px width is the same at all viewport sizes, matching the rest of
  this page's non-responsive layout today.
