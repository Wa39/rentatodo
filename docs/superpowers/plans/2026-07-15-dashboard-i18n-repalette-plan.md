# Dashboard i18n + Repalette Fixup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the already-committed portion of the dashboard visual redesign (Tasks 1-10 of `docs/superpowers/plans/2026-07-15-dashboard-visual-redesign-plan.md`) in line with the updated mockup and the human's revised English-first decision: swap in the new palette/font values, add a lightweight i18n scaffold, migrate every already-built component from hardcoded Spanish strings to that scaffold in English, and add the `other` category value that landed on `develop`.

**Architecture:** Same Vite/React/TypeScript/Tailwind/shadcn/Vitest stack. Colors continue flowing through `packages/design-tokens` → `apps/web/src/index.css`'s CSS variables → Tailwind utility classes, only the hex/HSL values and one new token (`onDarkAccent`) change — component markup that doesn't touch the new token needs no edits at all. A new `apps/web/src/lib/i18n/` module (a plain nested dictionary + a `useTranslation()` accessor, no Context/Provider yet since only one locale exists) replaces every hardcoded UI string; adding a second locale later means dropping in a new dictionary file and wiring real locale selection into `useTranslation`'s default argument, with zero call-site changes.

**Tech Stack:** Same as the existing scaffold — React 19, Vite 8, TypeScript 6.0.2, Tailwind CSS 3.4.14, shadcn/ui 2.3.0, Vitest 2.1, React Testing Library.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-07-15-dashboard-visual-redesign-design.md` — the "Addendum (2026-07-15, revision 2)" section is the source of truth for every value in this plan.
- Scope: only `apps/web` and `packages/design-tokens` may change. Never `apps/api`, `apps/mobile`, `.github/`, `e2e/`, `infra/`, or `packages/contracts/openapi.yaml`.
- Phase 1 only: no real network calls. Nothing in this plan touches data fetching — it only changes colors, fonts, and how strings are sourced.
- All user-facing text is **English** now (nav, buttons, labels, headings, status badges), sourced through `apps/web/src/lib/i18n`'s dictionary — never a hardcoded string literal in component JSX. Code identifiers, comments, and CSS classes stay in English as they already were.
- `ReservationStatus`, `DepositStatus`, `TransactionType` values are unchanged — still the exact contract values from `apps/web/src/lib/types.ts`. `Category` gains exactly one new value, `'other'`, matching `develop`'s `packages/contracts/openapi.yaml` (PR #13) — no other contract sync happens in this plan.
- Every existing test file touching markup this plan changes gets updated in the same task that changes the markup — never left red, never deleted to "fix" a failure.
- New design tokens are added only when a task in this plan actually consumes them (`onDarkAccent`, used by Task 12's dashboard KPI card). Other new tokens noted in the spec addendum (`line`, `redBorder`, `sidebarCard`, `closedTint`) have no consumer yet in this plan and are deliberately deferred to whichever future task builds their consuming UI — adding unused tokens now would be speculative.

---

## Task 1: Design tokens palette update

**Files:**
- Modify: `packages/design-tokens/tokens.ts`

**Interfaces:**
- Produces: same `colors` object shape as today (same 20 key names), all values updated to the new mockup's hex codes, plus one new key `onDarkAccent`.
- Consumed by: nothing programmatically today (unchanged from the original Task 1 — `apps/web/tailwind.config.ts` only imports `spacing` from this package; `apps/web/src/index.css`'s CSS variables, Task 4, are hand-derived from these hex sources but not actually imported at build time). This task is a documentation/source-of-truth update; Task 4 is where the visual change takes effect.

- [ ] **Step 1: Replace `packages/design-tokens/tokens.ts`**

```ts
// Mirrors the RentaTodo dashboard visual redesign mockup, revision 2
// ("RentaTodo Dashboard.html") — see docs/superpowers/specs/2026-07-15-dashboard-visual-redesign-design.md's
// "Addendum (2026-07-15, revision 2)" section for the full palette derivation.
// NOT apps/mobile's current colors — see README.md for why these two are
// intentionally out of sync.

export const colors = {
  sidebar: '#141F19',
  sidebarHover: '#1E2E26',
  sidebarBorder: '#263A30',
  sidebarForeground: '#AEBBB3',
  bg: '#EFEDE6',
  card: '#FFFFFF',
  border: '#E4E2D8',
  ink: '#17201B',
  inkSoft: '#5B655E',
  inkFaint: '#9AA39C',
  forest: '#1E7A4F',
  forestDark: '#155C3B',
  forestTint: '#E2F0E7',
  amber: '#D9862A',
  amberInk: '#241505',
  amberTint: '#F9ECD6',
  amberForeground: '#8F550F',
  red: '#C24A32',
  redTint: '#F7E1DA',
  blue: '#33608F',
  blueTint: '#E3EAF3',
  onDarkAccent: '#6FB88E',
} as const

export const spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const

export type Colors = typeof colors
export type Spacing = typeof spacing
```

- [ ] **Step 2: Verify**

Run: `pnpm install && pnpm --filter @rentatodo/web build`
Expected: exits 0 (this task doesn't change anything the build actually consumes yet, per the Interfaces note above — this just confirms nothing broke).

- [ ] **Step 3: Commit**

```bash
git add packages/design-tokens/tokens.ts
git commit -m "feat(design-tokens): update palette to the revision-2 dashboard mockup"
```

---

## Task 2: Add `other` to the `Category` type

**Files:**
- Modify: `apps/web/src/lib/types.ts`

**Interfaces:**
- Produces: `Category` union gains `'other'` (7 values total).
- Consumed by: Task 5 (the i18n dictionary's `categories` map must be exhaustive over `Category`, so this must land first), and anywhere else `Category` is already used (`Item.category`, `ItemDetail`).

- [ ] **Step 1: Modify `apps/web/src/lib/types.ts`**

Change the `Category` union (the first export in the file):

```ts
export type Category =
  | 'tools'
  | 'photography'
  | 'camping'
  | 'sports'
  | 'electronics'
  | 'home'
  | 'other'
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @rentatodo/web build`
Expected: FAILS with a TypeScript error in `apps/web/src/lib/categoryLabels.ts` — its `CATEGORY_LABELS: Record<Category, string>` is no longer exhaustive now that `Category` has 7 values but the object literal only has 6. This is the correct, expected outcome: `categoryLabels.ts` is deleted in Task 5 (replaced by the i18n dictionary's `categories` map, which does include `other`), so this failure is resolved there, not here. Confirm the build output names exactly this one error, in exactly this one file, before moving on.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(web): add 'other' to the Category type, matching develop's CategoryEnum"
```

---

## Task 3: Fonts and Tailwind config update

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/tailwind.config.ts`

**Interfaces:**
- Produces: `font-display`/`font-sans`/`font-mono` Tailwind utilities now backed by Bricolage Grotesque/Instrument Sans/IBM Plex Mono. New color key `on-dark-accent` (`hsl(var(--on-dark-accent))`), consumed by Task 12.

- [ ] **Step 1: Replace `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap"
      rel="stylesheet"
    />
    <title>RentaTodo — Owner Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Modify `apps/web/tailwind.config.ts`**

Change the `fontFamily` block:

```ts
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        sans: ['"Instrument Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
```

Add `'on-dark-accent'` immediately after the existing `'info-tint'` key inside `theme.extend.colors`:

```ts
        info: 'hsl(var(--info))',
        'info-tint': 'hsl(var(--info-tint))',
        'on-dark-accent': 'hsl(var(--on-dark-accent))',
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @rentatodo/web build`
Expected: FAILS with the same `apps/web/src/lib/categoryLabels.ts` exhaustiveness error from Task 2 — still not resolved until Task 5. Confirm it's still exactly that one error (nothing about this task's font/color config additions introduces a new one — Tailwind doesn't validate that a `var(--x)` reference resolves at build time, only at runtime in the browser, so `--on-dark-accent` not being defined in `index.css` yet, Task 4's job, causes no build error).

- [ ] **Step 4: Commit**

```bash
git add apps/web/index.html apps/web/tailwind.config.ts
git commit -m "feat(web): swap to Bricolage Grotesque/Instrument Sans/IBM Plex Mono, add on-dark-accent color"
```

---

## Task 4: shadcn CSS variables update

**Files:**
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Produces: every CSS variable in `:root` updated to the new mockup's HSL values, plus a new `--on-dark-accent` variable. `.dark` block, `@tailwind` directives, and the second `@layer base` block's `*`/`body` selectors are otherwise untouched except adding `font-sans` to `body` (see Step 1 note).

- [ ] **Step 1: Replace the first `@layer base` block (the `:root` and `.dark` rules) in `apps/web/src/index.css`**

Leave the file's other two lines (`@tailwind base/components/utilities` at the top, and the final `@layer base { * { ... } body { ... } }` block at the bottom) as they are, except add `font-sans` to the `body` rule — it was missing from the original scaffold, which meant `Instrument Sans` (and `Inter` before it) never actually applied as the page's default body font. Replace the first `@layer base` block with:

```css
@layer base {
  :root {
    --background: 47 22% 92%;          /* bg #EFEDE6 */
    --foreground: 147 16% 11%;         /* ink #17201B */
    --card: 0 0% 100%;                 /* card #FFFFFF */
    --card-foreground: 147 16% 11%;    /* ink */
    --popover: 0 0% 100%;              /* card */
    --popover-foreground: 147 16% 11%; /* ink */
    --primary: 152 61% 30%;            /* forest #1E7A4F */
    --primary-foreground: 0 0% 100%;   /* white text on forest */
    --secondary: 141 32% 91%;          /* forest-tint #E2F0E7 */
    --secondary-foreground: 152 63% 22%; /* forest-dark #155C3B */
    --muted: 50 18% 87%;               /* border #E4E2D8 */
    --muted-foreground: 138 5% 38%;    /* ink-soft #5B655E */
    --accent: 141 32% 91%;             /* forest-tint */
    --accent-foreground: 152 63% 22%;  /* forest-dark */
    --destructive: 10 59% 48%;         /* red #C24A32 */
    --destructive-foreground: 0 0% 100%; /* white */
    --destructive-tint: 14 64% 91%;    /* red-tint #F7E1DA */
    --warning: 32 70% 51%;             /* amber #D9862A, solid fill */
    --warning-ink: 31 76% 8%;          /* amber-ink #241505, text on solid --warning (unchanged) */
    --warning-tint: 38 74% 91%;        /* amber-tint #F9ECD6 */
    --warning-foreground: 33 81% 31%;  /* amber-foreground #8F550F, text on --warning-tint */
    --info: 211 47% 38%;               /* blue #33608F */
    --info-tint: 214 40% 92%;          /* blue-tint #E3EAF3 */
    --on-dark-accent: 145 34% 58%;     /* #6FB88E, accent text/icon on dark surfaces */
    --border: 50 18% 87%;              /* border */
    --input: 50 18% 87%;               /* border */
    --ring: 152 61% 30%;               /* forest */
    --sidebar: 147 22% 10%;            /* sidebar #141F19 */
    --sidebar-foreground: 143 9% 71%;  /* sidebar-foreground #AEBBB3 */
    --sidebar-primary: 152 61% 30%;    /* forest, active nav item bg */
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 150 21% 15%;     /* sidebar-hover #1E2E26 */
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 150 21% 19%;     /* sidebar-border #263A30 (unchanged) */
    --sidebar-ring: 152 61% 30%;       /* forest */
    --radius: 0.625rem;
  }
  .dark {
    --background: oklch(0.141 0.005 285.823);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.21 0.006 285.885);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.21 0.006 285.885);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.92 0.004 286.32);
    --primary-foreground: oklch(0.21 0.006 285.885);
    --secondary: oklch(0.274 0.006 286.033);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.274 0.006 286.033);
    --muted-foreground: oklch(0.705 0.015 286.067);
    --accent: oklch(0.274 0.006 286.033);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.552 0.016 285.938);
    --chart-1: oklch(0.871 0.006 286.286);
    --chart-2: oklch(0.552 0.016 285.938);
    --chart-3: oklch(0.442 0.017 285.786);
    --chart-4: oklch(0.37 0.013 285.805);
    --chart-5: oklch(0.274 0.006 286.033);
    --sidebar: oklch(0.21 0.006 285.885);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.274 0.006 286.033);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.552 0.016 285.938)
  }
}
```

And change the final `@layer base` block's `body` rule to:

```css
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans;
  }
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @rentatodo/web test -- --run`
Expected: PASS — no component's markup or text changed in Tasks 1-4, only the color/font *values* behind unchanged class names and the (not-yet-consumed) `Category` type, so every existing assertion (Spanish text, `bg-warning-tint`-style class names) still holds.

Run: `pnpm --filter @rentatodo/web build`
Expected: FAILS with the same `apps/web/src/lib/categoryLabels.ts` exhaustiveness error from Task 2 — still not resolved (Task 5 resolves it by deleting that file). Confirm it's still exactly that one error before moving on.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat(web): apply revision-2 palette HSL values and on-dark-accent to shadcn CSS variables"
```

---

## Task 5: i18n scaffold

**Files:**
- Create: `apps/web/src/lib/i18n/en.ts`
- Create: `apps/web/src/lib/i18n/index.ts`
- Test: `apps/web/src/lib/i18n/index.test.ts`
- Delete: `apps/web/src/lib/categoryLabels.ts`

**Interfaces:**
- Consumes: `Category` from `@/lib/types` (Task 2).
- Produces: `en` dictionary object; `type Translations = typeof en`; `useTranslation(locale?: 'en'): Translations`. Every dictionary key used by Tasks 6-12 is defined here — this is the single source, later tasks only read from it. Consumed by Tasks 6-12.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/i18n/index.test.ts
import { describe, expect, it } from 'vitest'
import { useTranslation } from './index'

describe('useTranslation', () => {
  it('defaults to the English dictionary', () => {
    const t = useTranslation()
    expect(t.login.submit).toBe('Sign in')
  })

  it('returns the English dictionary when locale is explicitly "en"', () => {
    const t = useTranslation('en')
    expect(t.nav.overview).toBe('Overview')
  })

  it('has an English label for every category, including the new "other" value', () => {
    const t = useTranslation()
    expect(t.categories.other).toBe('Other')
    expect(Object.keys(t.categories)).toHaveLength(7)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- i18n/index.test`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Create `apps/web/src/lib/i18n/en.ts`**

```ts
export const en = {
  nav: {
    groupPanel: 'Panel',
    groupInventory: 'Inventory',
    groupActivity: 'Activity',
    groupFinance: 'Finance',
    overview: 'Overview',
    myItems: 'My items',
    publishItem: 'Publish item',
    requests: 'Requests',
    earnings: 'Earnings',
    logOut: 'Log out',
    ownerRole: 'Owner',
  },
  login: {
    title: 'Sign in',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
  },
  register: {
    title: 'Create account',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    submit: 'Create account',
  },
  statusBadge: {
    requested: 'Pending',
    approved: 'Approved',
    delivered: 'Active',
    returned: 'Active',
    closed: 'Closed',
    rejected: 'Rejected',
    cancelled: 'Rejected',
  },
  calendar: {
    weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
  },
  itemCard: {
    next14Days: 'Next 14 days',
    inactive: 'Inactive · not visible in search',
    edit: 'Edit',
    calendar: 'Calendar',
    delete: 'Delete',
    perDay: '/day',
  },
  categories: {
    tools: 'Tools',
    photography: 'Photography',
    camping: 'Camping',
    sports: 'Sports',
    electronics: 'Electronics',
    home: 'Home',
    other: 'Other',
  },
  dashboard: {
    title: 'Overview',
    welcomeBack: (firstName: string) => `Welcome back, ${firstName}`,
    publishItem: '+ Publish item',
    kpiActiveItems: 'Active items',
    kpiPendingRequests: 'Pending requests',
    kpiActiveReservations: 'Active reservations',
    kpiEarnedThisMonth: 'Earned this month',
    recentRequestsTitle: 'Recent requests',
    recentRequestsSubtitle: 'What needs your attention',
    viewAll: 'View all',
    requestSummary: (renterName: string, itemName: string) => `${renterName} requested ${itemName}`,
    reject: 'Reject',
    approve: 'Approve',
  },
} as const
```

Note: `categories` is a plain object literal here, not typed as `Record<Category, string>` — `en.ts` has no reason to import app types (it's pure data). `index.ts`'s `Translations` type is derived from `typeof en` instead, and Task 2's `Category` union is what Task 5's own test (Step 1's third case) checks against by asserting the key count, since there is no other file left importing `Category` for this purpose after `categoryLabels.ts` is deleted.

- [ ] **Step 4: Create `apps/web/src/lib/i18n/index.ts`**

```ts
import { en } from './en'

export type Translations = typeof en

const translations: Record<'en', Translations> = { en }

export function useTranslation(locale: keyof typeof translations = 'en'): Translations {
  return translations[locale]
}
```

- [ ] **Step 5: Delete `apps/web/src/lib/categoryLabels.ts`**

```bash
rm apps/web/src/lib/categoryLabels.ts
```

Its only consumer, `apps/web/src/components/ItemCard.tsx`, is updated in Task 8 to import `useTranslation` instead — until Task 8 runs, `ItemCard.tsx` will fail to build with a "cannot find module './categoryLabels'" error. That's expected; Tasks 5-8 must land together before the next `pnpm build`/full test run.

- [ ] **Step 6: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- i18n/index.test`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/i18n apps/web/src/lib/categoryLabels.ts
git commit -m "feat(web): add lightweight i18n scaffold (English dictionary), replacing categoryLabels"
```

---

## Task 6: Migrate `StatusBadge` to i18n + add the dot indicator

**Files:**
- Modify: `apps/web/src/components/StatusBadge.tsx`
- Modify: `apps/web/src/components/StatusBadge.test.tsx`

**Interfaces:**
- Consumes: `useTranslation` from `@/lib/i18n` (Task 5).
- Produces: same `StatusBadge({ status: ReservationStatus })` export, now English-labeled with a colored dot, `delivered`/`returned` sharing the "Active" label and `rejected`/`cancelled` sharing "Rejected" (per the spec addendum's mockup-driven mapping).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/StatusBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReservationStatus } from '@/lib/types'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the English label and warning colors for a requested reservation', () => {
    render(<StatusBadge status="requested" />)
    const badge = screen.getByText('Pending').closest('span')!
    expect(badge).toHaveClass('bg-warning-tint')
    expect(badge).toHaveClass('text-warning-foreground')
  })

  it('renders the English label and destructive-tint colors for a rejected reservation', () => {
    render(<StatusBadge status="rejected" />)
    const badge = screen.getByText('Rejected').closest('span')!
    expect(badge).toHaveClass('bg-destructive-tint')
    expect(badge).toHaveClass('text-destructive')
  })

  it('renders the correct English label for every status, merging delivered/returned into "Active" and rejected/cancelled into "Rejected"', () => {
    const expected: Record<ReservationStatus, string> = {
      requested: 'Pending',
      approved: 'Approved',
      delivered: 'Active',
      returned: 'Active',
      closed: 'Closed',
      rejected: 'Rejected',
      cancelled: 'Rejected',
    }
    for (const status of Object.keys(expected) as ReservationStatus[]) {
      const { unmount } = render(<StatusBadge status={status} />)
      expect(screen.getByText(expected[status])).toBeInTheDocument()
      unmount()
    }
  })

  it('renders a colored dot indicator before the label', () => {
    const { container } = render(<StatusBadge status="approved" />)
    const dot = container.querySelector('span > span')
    expect(dot).toHaveClass('bg-primary')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- StatusBadge.test`
Expected: FAIL — old component still renders Spanish labels and has no nested dot `<span>`.

- [ ] **Step 3: Replace `apps/web/src/components/StatusBadge.tsx`**

```tsx
import { useTranslation } from '@/lib/i18n'
import type { ReservationStatus } from '@/lib/types'

const STATUS_STYLES: Record<ReservationStatus, { bg: string; text: string; dot: string }> = {
  requested: { bg: 'bg-warning-tint', text: 'text-warning-foreground', dot: 'bg-warning' },
  approved: { bg: 'bg-secondary', text: 'text-secondary-foreground', dot: 'bg-primary' },
  delivered: { bg: 'bg-info-tint', text: 'text-info', dot: 'bg-info' },
  returned: { bg: 'bg-info-tint', text: 'text-info', dot: 'bg-info' },
  closed: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
  rejected: { bg: 'bg-destructive-tint', text: 'text-destructive', dot: 'bg-destructive' },
  cancelled: { bg: 'bg-destructive-tint', text: 'text-destructive', dot: 'bg-destructive' },
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const t = useTranslation()
  const style = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-two py-half text-xs font-bold uppercase tracking-wide ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {t.statusBadge[status]}
    </span>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- StatusBadge.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/StatusBadge.tsx apps/web/src/components/StatusBadge.test.tsx
git commit -m "feat(web): migrate StatusBadge to i18n dictionary, add dot indicator"
```

---

## Task 7: Migrate `CalendarMonth` to i18n

**Files:**
- Modify: `apps/web/src/components/CalendarMonth.tsx`
- Modify: `apps/web/src/components/CalendarMonth.test.tsx`

**Interfaces:**
- Consumes: `useTranslation` from `@/lib/i18n` (Task 5), specifically `t.calendar.months`/`t.calendar.weekdays`.
- Produces: same `CalendarMonth({ monthStart, unavailableDates })` export, now rendering English month/weekday labels.

- [ ] **Step 1: Update the failing assertion in `apps/web/src/components/CalendarMonth.test.tsx`**

Change the month-label assertion (the rest of the file — imports, `beforeEach`/`afterEach`, the booked/today assertions — stays exactly as it is):

```tsx
    expect(screen.getByText('July 2026')).toBeInTheDocument()
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- CalendarMonth.test`
Expected: FAIL — component still renders `'Julio 2026'`.

- [ ] **Step 3: Modify `apps/web/src/components/CalendarMonth.tsx`**

```tsx
import { getMonthGridDays, isDateBooked, toDateOnlyString } from '@/lib/calendar'
import { useTranslation } from '@/lib/i18n'
import type { UnavailableRange } from '@/lib/types'

export function CalendarMonth({
  monthStart,
  unavailableDates,
}: {
  monthStart: Date
  unavailableDates: UnavailableRange[]
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
          const booked = day.inCurrentMonth && isDateBooked(dateStr, unavailableDates)
          return (
            <div
              key={dateStr}
              className={`flex aspect-square items-center justify-center rounded-md text-sm font-medium ${
                !day.inCurrentMonth
                  ? 'text-muted-foreground opacity-30'
                  : booked
                    ? 'bg-destructive font-bold text-destructive-foreground'
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
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CalendarMonth.tsx apps/web/src/components/CalendarMonth.test.tsx
git commit -m "feat(web): migrate CalendarMonth to i18n dictionary"
```

---

## Task 8: Migrate `ItemCard` to i18n

**Files:**
- Modify: `apps/web/src/components/ItemCard.tsx`
- Modify: `apps/web/src/components/ItemCard.test.tsx`

**Interfaces:**
- Consumes: `useTranslation` from `@/lib/i18n` (Task 5), specifically `t.categories`/`t.itemCard.*`. `categoryLabels.ts` (deleted in Task 5) is no longer imported.
- Produces: same `ItemCard({ item, onEdit?, onDelete?, readOnly? })` export, now English-labeled.

- [ ] **Step 1: Update `apps/web/src/components/ItemCard.test.tsx`**

```tsx
// apps/web/src/components/ItemCard.test.tsx
import { render, screen } from '@testing-library/react'
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

  it('shows the inactive message instead of the strip for an inactive item', () => {
    const item = mockItems.find((i) => !i.is_active)!
    render(
      <MemoryRouter>
        <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Inactive · not visible in search')).toBeInTheDocument()
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
Expected: FAIL — old component still imports the deleted `categoryLabels.ts` and renders Spanish text.

- [ ] **Step 3: Replace `apps/web/src/components/ItemCard.tsx`**

```tsx
import { Link } from 'react-router-dom'
import type { Item } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { getAvailabilityStrip } from '@/lib/availability'
import { useTranslation } from '@/lib/i18n'
import { mockItemDetail } from '@/lib/mockData'
import { Button } from '@/components/ui/button'

interface ItemCardProps {
  item: Item
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  readOnly?: boolean
}

export function ItemCard({ item, onEdit, onDelete, readOnly = false }: ItemCardProps) {
  const t = useTranslation()
  const detail = mockItemDetail(item.id)
  const strip = getAvailabilityStrip(detail?.unavailable_dates ?? [])

  return (
    <div data-testid={`item-card-${item.id}`} className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-secondary to-card">
        <span className="absolute left-two top-two rounded-full bg-foreground/75 px-two py-half text-xs font-semibold capitalize text-card">
          {t.categories[item.category]}
        </span>
      </div>
      <div className="space-y-two p-three">
        <div className="flex items-start justify-between gap-two">
          <Link to={`/items/${item.id}`} className="font-semibold text-foreground hover:text-primary">
            {item.name}
          </Link>
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
                <div key={index} className={`h-4 flex-1 rounded-sm ${day === 'booked' ? 'bg-destructive/65' : 'bg-muted'}`} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">{t.itemCard.inactive}</p>
        )}
        {!readOnly && (
          <div className="flex gap-two pt-one">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit?.(item)}>
              {t.itemCard.edit}
            </Button>
            <Button size="sm" variant="outline" className="flex-1" asChild>
              <Link to={`/items/${item.id}`}>{t.itemCard.calendar}</Link>
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => onDelete?.(item)}>
              {t.itemCard.delete}
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
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ItemCard.tsx apps/web/src/components/ItemCard.test.tsx
git commit -m "feat(web): migrate ItemCard to i18n dictionary"
```

---

## Task 9: Migrate `DashboardLayout` to i18n

**Files:**
- Modify: `apps/web/src/layouts/DashboardLayout.tsx`
- Modify: `apps/web/src/layouts/DashboardLayout.test.tsx`

**Interfaces:**
- Consumes: `useTranslation` from `@/lib/i18n` (Task 5), specifically `t.nav.*`.
- Produces: same `DashboardLayout` export, now English-labeled.

- [ ] **Step 1: Update `apps/web/src/layouts/DashboardLayout.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { DashboardLayout } from './DashboardLayout'

describe('DashboardLayout', () => {
  it('renders nav links for every top-level dashboard section', () => {
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

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'My items' })).toHaveAttribute('href', '/items')
    expect(screen.getByRole('link', { name: 'Publish item' })).toHaveAttribute('href', '/items/publish')
    expect(screen.getByRole('link', { name: /^Requests/ })).toHaveAttribute('href', '/requests')
    expect(screen.getByRole('link', { name: 'Earnings' })).toHaveAttribute('href', '/earnings')
    expect(screen.getByText('Home content')).toBeInTheDocument()
  })

  it('shows a pending-request count badge on the Requests link', () => {
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
    const requestsLink = screen.getByRole('link', { name: /^Requests/ })
    expect(requestsLink).toHaveTextContent(/\d+/)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- DashboardLayout.test`
Expected: FAIL — component still renders Spanish nav labels.

- [ ] **Step 3: Replace `apps/web/src/layouts/DashboardLayout.tsx`**

```tsx
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useTranslation } from '@/lib/i18n'
import { mockRequests, mockUser } from '@/lib/mockData'
import { Button } from '@/components/ui/button'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function DashboardLayout() {
  const { logout } = useAuth()
  const location = useLocation()
  const t = useTranslation()
  const pendingCount = mockRequests.filter((r) => r.status === 'requested').length

  const navGroups = [
    { label: t.nav.groupPanel, items: [{ to: '/dashboard', label: t.nav.overview }] },
    {
      label: t.nav.groupInventory,
      items: [
        { to: '/items', label: t.nav.myItems },
        { to: '/items/publish', label: t.nav.publishItem },
      ],
    },
    { label: t.nav.groupActivity, items: [{ to: '/requests', label: t.nav.requests }] },
    { label: t.nav.groupFinance, items: [{ to: '/earnings', label: t.nav.earnings }] },
  ]

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-60 flex-shrink-0 flex-col bg-sidebar p-four text-sidebar-foreground">
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
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-two rounded-md px-two py-one text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`}
                    >
                      {item.label}
                      {item.to === '/requests' && pendingCount > 0 && (
                        <span className="ml-auto rounded-full bg-warning px-half text-xs font-bold text-warning-ink">
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
      <main className="flex-1 overflow-y-auto p-four">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- DashboardLayout.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/layouts/DashboardLayout.tsx apps/web/src/layouts/DashboardLayout.test.tsx
git commit -m "feat(web): migrate DashboardLayout to i18n dictionary"
```

---

## Task 10: Migrate `LoginPage` to i18n (+ `App.test.tsx`)

**Files:**
- Modify: `apps/web/src/routes/LoginPage.tsx`
- Modify: `apps/web/src/routes/LoginPage.test.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `useTranslation` from `@/lib/i18n` (Task 5), specifically `t.login.*`.
- Produces: same `LoginPage` export, now English-labeled. No behavior change — `login()`/`navigate('/dashboard')` unchanged.

- [ ] **Step 1: Update `apps/web/src/routes/LoginPage.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { LoginPage } from './LoginPage'

function StatusProbe() {
  const { isAuthenticated } = useAuth()
  return <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
}

describe('LoginPage', () => {
  it('renders email/password fields, authenticates, and navigates to /dashboard on submit', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <StatusProbe />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByTestId('status')).toHaveTextContent('in')
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- LoginPage.test`
Expected: FAIL — component still renders Spanish labels (`Correo electrónico`, `Contraseña`, `Iniciar sesión`).

- [ ] **Step 3: Replace `apps/web/src/routes/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const t = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Phase 1: no real POST /auth/login call yet — just flips local auth state.
    login()
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-three rounded-lg border border-border bg-card p-four">
        <h1 className="font-display text-lg font-semibold text-foreground">{t.login.title}</h1>
        <div className="space-y-half">
          <Label htmlFor="email">{t.login.email}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="password">{t.login.password}</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">
          {t.login.submit}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run the `LoginPage` test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- LoginPage.test`
Expected: PASS.

- [ ] **Step 5: Update `apps/web/src/App.test.tsx`**

Change the button-name assertion (the rest of the file stays exactly as it is):

```tsx
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
```

- [ ] **Step 6: Run the full test suite and verify `App.test.tsx` passes**

Run: `pnpm --filter @rentatodo/web test -- App.test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/LoginPage.tsx apps/web/src/routes/LoginPage.test.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): migrate LoginPage to i18n dictionary"
```

---

## Task 11: Migrate `RegisterPage` to i18n

**Files:**
- Modify: `apps/web/src/routes/RegisterPage.tsx`
- Modify: `apps/web/src/routes/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: `useTranslation` from `@/lib/i18n` (Task 5), specifically `t.register.*`.
- Produces: same `RegisterPage` export, now English-labeled. No behavior change — `navigate('/login')` unchanged.

- [ ] **Step 1: Update `apps/web/src/routes/RegisterPage.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RegisterPage } from './RegisterPage'

describe('RegisterPage', () => {
  it('renders name/email/password fields and navigates to /login on submit', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- RegisterPage.test`
Expected: FAIL — component still renders Spanish labels (`Nombre`, `Correo electrónico`, `Contraseña`, `Crear cuenta`).

- [ ] **Step 3: Replace `apps/web/src/routes/RegisterPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterPage() {
  const navigate = useNavigate()
  const t = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Phase 1: no real POST /auth/register call yet — just routes to /login.
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-three rounded-lg border border-border bg-card p-four">
        <h1 className="font-display text-lg font-semibold text-foreground">{t.register.title}</h1>
        <div className="space-y-half">
          <Label htmlFor="name">{t.register.name}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="email">{t.register.email}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="password">{t.register.password}</Label>
          <Input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">
          {t.register.submit}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- RegisterPage.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/RegisterPage.tsx apps/web/src/routes/RegisterPage.test.tsx
git commit -m "feat(web): migrate RegisterPage to i18n dictionary"
```

---

## Task 12: Migrate `DashboardPage` to i18n + inverted "Earned this month" KPI card

**Files:**
- Modify: `apps/web/src/routes/DashboardPage.tsx`
- Modify: `apps/web/src/routes/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `useTranslation` from `@/lib/i18n` (Task 5), specifically `t.dashboard.*`; `on-dark-accent` Tailwind color (Task 3) via the `text-on-dark-accent` class.
- Produces: same `DashboardPage` export, now English-labeled, with its 4th KPI card ("Earned this month") dark-inverted per the spec addendum instead of sharing the other 3 cards' light-card treatment.

- [ ] **Step 1: Update `apps/web/src/routes/DashboardPage.test.tsx`**

```tsx
// apps/web/src/routes/DashboardPage.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems, mockRequests } from '@/lib/mockData'
import { DashboardPage } from './DashboardPage'

describe('DashboardPage', () => {
  it('renders KPI cards derived from mock data', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    const activeItems = mockItems.filter((i) => i.is_active).length
    const pending = mockRequests.filter((r) => r.status === 'requested').length

    const activeItemsCard = screen.getByText('Active items').closest('div')!
    expect(within(activeItemsCard).getByText(String(activeItems))).toBeInTheDocument()

    const pendingCard = screen.getByText('Pending requests').closest('div')!
    expect(within(pendingCard).getByText(String(pending))).toBeInTheDocument()
  })

  it('renders the "Earned this month" KPI card with the dark-inverted treatment', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    const earnedCard = screen.getByText('Earned this month').closest('div')!
    expect(earnedCard).toHaveClass('bg-sidebar')
    expect(within(earnedCard).getByText((content) => content.startsWith('$'))).toHaveClass('text-on-dark-accent')
  })

  it('shows at most 2 pending requests and lets you approve one', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    const firstPending = mockRequests.filter((r) => r.status === 'requested')[0]
    const row = screen.getByText(new RegExp(firstPending.renter_name)).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Approve' }))
    expect(screen.queryByText(new RegExp(firstPending.renter_name))).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- DashboardPage.test`
Expected: FAIL — component still renders Spanish labels and the 4th KPI card doesn't have `bg-sidebar`/`text-on-dark-accent` yet.

- [ ] **Step 3: Replace `apps/web/src/routes/DashboardPage.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mockEarnings, mockItems, mockRequests, mockUser } from '@/lib/mockData'
import type { Reservation } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function DashboardPage() {
  const t = useTranslation()
  const [requests, setRequests] = useState<Reservation[]>(mockRequests)
  const activeItems = mockItems.filter((item) => item.is_active).length
  const pendingRequests = requests.filter((r) => r.status === 'requested')
  const activeReservations = requests.filter((r) => ['approved', 'delivered'].includes(r.status)).length
  const recentPending = pendingRequests.slice(0, 2)

  function setStatus(id: string, status: Reservation['status']) {
    setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  return (
    <div className="space-y-four">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground">{t.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground">{t.dashboard.welcomeBack(mockUser.name.split(' ')[0])}</p>
        </div>
        <Button asChild>
          <Link to="/items/publish">{t.dashboard.publishItem}</Link>
        </Button>
      </div>

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
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- DashboardPage.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full web test suite and build**

Run: `pnpm --filter @rentatodo/web test -- --run` then `pnpm --filter @rentatodo/web build`
Expected: all tests PASS, build exits 0 — this is the first point since Task 1 where every file in the repo is mutually consistent (Tasks 5-8's intentional intermediate breakage, noted in Task 5 Step 5, is now fully resolved).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/DashboardPage.tsx apps/web/src/routes/DashboardPage.test.tsx
git commit -m "feat(web): migrate DashboardPage to i18n dictionary, add dark-inverted earned-this-month KPI card"
```

---

## Closing Note

This plan covers only the fixup of already-committed work (original plan Tasks 1-10). The original plan's Tasks 11-17 (ItemsPage, PublishItemPage, RequestsPage, ItemDetailPage, ReservationDetailPage, EarningsPage, router wiring) have not been built yet and remain valid for their *structure* (data derivation, route wiring, test scenarios) — but must be built against `apps/web/src/lib/i18n`'s dictionary (adding new keys per page, e.g. `t.items`, `t.requests`, `t.earnings`, `t.reservationDetail`, following this plan's `t.dashboard`/`t.itemCard` pattern) and in English, not by copying the original plan's Spanish string literals. That follow-up work — plus the deferred `line`/`redBorder`/`sidebarCard`/`closedTint` tokens, which only those pages consume — needs its own planning pass once this plan lands, since writing it now would mean guessing at code for components that don't exist yet under a design system this plan hasn't landed.
