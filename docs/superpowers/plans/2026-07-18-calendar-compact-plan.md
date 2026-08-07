# Compact Calendar + Today Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the owner's two-month calendar (`/requests/calendar`) from full-page-width to a compact ~280px-per-month size, and replace the barely-visible "today" ring with a noticeable colored dot.

**Architecture:** No new files, no data/logic changes. Task 1 changes `CalendarPage.tsx`'s layout container from a stretching `grid grid-cols-2` to a content-sized `flex w-fit` with two fixed-280px wrappers. Task 2 changes `CalendarMonth.tsx`'s today-cell styling from a ring to an absolutely-positioned dot `<span>`, and updates its test to match.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library, Tailwind CSS. No new dependencies.

**Source of truth:** `docs/superpowers/specs/2026-07-18-calendar-compact-design.md`.

## Global Constraints

- Conventional Commits (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`) — one commit per task.
- TDD: update the test first, watch it fail for the right reason, then make it pass.
- Match existing code style exactly: no semicolons, single quotes, no comments except where the WHY is non-obvious.
- All existing tests must keep passing after each task (`cd apps/web && npx vitest run`).
- Don't touch `apps/api` or `apps/mobile` — this plan is `apps/web` only.
- Work from `D:\Programacion\rentatodo\.worktrees\calendar-compact` (this branch's dedicated worktree); all commands below assume `cd apps/web` first.

---

### Task 1: Compact, fixed-width two-month calendar layout

**Files:**
- Modify: `apps/web/src/routes/CalendarPage.tsx:83-86`
- Test: `apps/web/src/routes/CalendarPage.test.tsx` (add a case)

**Interfaces:**
- No exported interface changes — internal layout fix only.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/routes/CalendarPage.test.tsx`, at the end of the `describe('CalendarPage', ...)` block:

```typescript

  it('renders each month at a fixed compact width instead of stretching full-width', () => {
    renderPage()
    const monthHeadings = screen.getAllByText(/2026$/)
    expect(monthHeadings).toHaveLength(2)
    for (const heading of monthHeadings) {
      expect(heading.parentElement).toHaveClass('w-[280px]')
    }
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/routes/CalendarPage.test.tsx`
Expected: FAIL — neither month label's parent has a `w-[280px]` class yet (the current parent is `CalendarMonth`'s own root `<div>`, a direct child of the `grid grid-cols-2` container, which carries no width class at all).

- [ ] **Step 3: Fix the implementation**

In `apps/web/src/routes/CalendarPage.tsx`, replace lines 83-86:

```typescript
        <div className="grid grid-cols-2 gap-four rounded-lg border border-border bg-card p-four">
          <CalendarMonth monthStart={firstMonth} dateRanges={dateRanges} />
          <CalendarMonth monthStart={secondMonth} dateRanges={dateRanges} />
        </div>
```

with:

```typescript
        <div className="flex w-fit gap-four rounded-lg border border-border bg-card p-four">
          <div className="w-[280px]">
            <CalendarMonth monthStart={firstMonth} dateRanges={dateRanges} />
          </div>
          <div className="w-[280px]">
            <CalendarMonth monthStart={secondMonth} dateRanges={dateRanges} />
          </div>
        </div>
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/routes/CalendarPage.test.tsx`
Expected: PASS, all cases (this is a pure layout change — no existing test asserts on the old `grid-cols-2` class, so nothing else should break; confirm by reading the full test output, not just the new case).

- [ ] **Step 5: Run the full suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/CalendarPage.tsx apps/web/src/routes/CalendarPage.test.tsx
git commit -m "fix(web): render the two-month calendar at a fixed compact width"
```

---

### Task 2: Replace the today ring with a visible dot

**Files:**
- Modify: `apps/web/src/components/CalendarMonth.tsx:31-44`
- Modify: `apps/web/src/components/CalendarMonth.test.tsx`

**Interfaces:**
- No exported interface changes — internal rendering fix only. The day cell gains a child `<span data-testid="today-dot">` when `day.isToday` is true; no other markup changes.

- [ ] **Step 1: Update the test to check for the dot instead of the ring**

Replace `apps/web/src/components/CalendarMonth.test.tsx` in full:

```typescript
import { render, screen, within } from '@testing-library/react'
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
  })

  it('shows a dot on today and no dot on other days', () => {
    render(<CalendarMonth monthStart={new Date(2026, 6, 1)} dateRanges={[]} />)

    const todayCell = screen.getByText('14').closest('div')!
    expect(within(todayCell).getByTestId('today-dot')).toBeInTheDocument()

    const otherCell = screen.getByText('13').closest('div')!
    expect(within(otherCell).queryByTestId('today-dot')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify the new case fails**

Run: `cd apps/web && npx vitest run src/components/CalendarMonth.test.tsx`
Expected: FAIL on `'shows a dot on today and no dot on other days'` — no element with `data-testid="today-dot"` exists yet.

- [ ] **Step 3: Fix the implementation**

In `apps/web/src/components/CalendarMonth.tsx`, replace lines 31-44:

```typescript
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
```

with:

```typescript
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/components/CalendarMonth.test.tsx`
Expected: PASS, both cases.

- [ ] **Step 5: Run the full suite and the build**

Run: `cd apps/web && npx vitest run`
Expected: PASS, every test file.

Run: `cd apps/web && npx tsc -b`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/CalendarMonth.tsx apps/web/src/components/CalendarMonth.test.tsx
git commit -m "fix(web): replace the barely-visible today ring with a colored dot"
```

---

## After this plan

The `/requests/calendar` page renders both months at a fixed, compact
~280px width instead of stretching full-page, and today's date is marked
with a visible green dot instead of a subtle ring. Push
`feature/calendar-compact` and open a PR against `develop` (per gitflow —
nobody pushes directly to `develop`).
