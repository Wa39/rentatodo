# Dashboard Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `apps/web`'s existing 8 pages to match Silverk's dashboard mockup (sidebar layout, forest-green palette, new fonts) and fold in the content it adds (dashboard KPIs, a live-preview publish page, a working two-month calendar, per-item renter history) — translating all UI text to Spanish in the process.

**Architecture:** Same Vite/React/TypeScript/Tailwind/shadcn/Vitest stack, same 8 routes plus one new one (`/items/publish`). Visual system changes flow through `packages/design-tokens` → `apps/web/tailwind.config.ts` → `apps/web/src/index.css`'s CSS variables, so every existing shadcn component re-themes automatically. Three new shared components (`StatusBadge`, `ItemCard`, `CalendarMonth`) get built once and reused across pages, backed by two new pure-logic modules (`lib/calendar.ts`, `lib/availability.ts`) that are unit-tested independently of any component.

**Tech Stack:** Same as the existing scaffold — React 19, Vite 8, TypeScript 6.0.2, Tailwind CSS 3.4.14, shadcn/ui 2.3.0, Vitest 2.1, React Testing Library, `lucide-react` (already a dependency since Task 6 of the original scaffold).

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-07-15-dashboard-visual-redesign-design.md` — read it before starting; every color value, Spanish label, and structural decision below is sourced from it.
- Scope: only `apps/web` and `packages/design-tokens` may change. Never `apps/api`, `apps/mobile`, `.github/`, `e2e/`, `infra/`, `packages/contracts/openapi.yaml`.
- Phase 1 only: no real network calls. The calendar's month navigation and the publish page's live preview are real, working client-side interactions — but backed entirely by `apps/web/src/lib/mockData.ts`, never a fetch call.
- All user-facing text is Spanish (nav, buttons, labels, headings, status badges). Code identifiers, comments, and CSS classes stay in English.
- Money: integer USD centavos, `formatCentavos` for display — unchanged.
- `Category`/`ReservationStatus`/`DepositStatus`/`TransactionType` — unchanged, still the exact contract values from `apps/web/src/lib/types.ts`.
- Exact CSS variable values (HSL) for `apps/web/src/index.css`'s `:root` block, copied verbatim from the spec:
  ```
  --background: 120 10% 96%;
  --foreground: 155 21% 11%;
  --card: 0 0% 100%;
  --card-foreground: 155 21% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 155 21% 11%;
  --primary: 149 41% 31%;
  --primary-foreground: 0 0% 100%;
  --secondary: 138 26% 93%;
  --secondary-foreground: 150 39% 22%;
  --muted: 132 9% 90%;
  --muted-foreground: 152 8% 39%;
  --accent: 138 26% 93%;
  --accent-foreground: 150 39% 22%;
  --destructive: 9 61% 47%;
  --destructive-foreground: 0 0% 100%;
  --destructive-tint: 12 64% 92%;
  --warning: 33 70% 51%;
  --warning-ink: 31 76% 8%;
  --warning-tint: 37 81% 92%;
  --warning-foreground: 34 77% 35%;
  --info: 216 52% 43%;
  --info-tint: 217 50% 93%;
  --border: 132 9% 90%;
  --input: 132 9% 90%;
  --ring: 149 41% 31%;
  --sidebar: 152 23% 11%;
  --sidebar-foreground: 138 12% 83%;
  --sidebar-primary: 149 41% 31%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 153 23% 16%;
  --sidebar-accent-foreground: 0 0% 100%;
  --sidebar-border: 150 21% 19%;
  --sidebar-ring: 149 41% 31%;
  --radius: 0.625rem;
  ```
  The existing `.dark` block in `index.css` is untouched (dark mode stays out of scope).
- `ReservationStatus` → Spanish label + badge color mapping (used by the new `StatusBadge` component, Task 4):
  | Status | Label | Classes |
  |---|---|---|
  | `requested` | Solicitada | `bg-warning-tint text-warning-foreground` |
  | `approved` | Aprobada | `bg-secondary text-secondary-foreground` |
  | `delivered` | Entregada | `bg-info-tint text-info` |
  | `returned` | Devuelta | `bg-info-tint text-info` |
  | `closed` | Cerrada | `bg-muted text-muted-foreground` |
  | `rejected` | Rechazada | `bg-destructive-tint text-destructive` |
  | `cancelled` | Cancelada | `bg-destructive-tint text-destructive` |
- `Category` → Spanish label mapping (used by `ItemCard`, `ItemsPage`, `PublishItemPage`, `ItemDetailPage`): `tools`→Herramientas, `photography`→Fotografía, `camping`→Camping, `sports`→Deportes, `electronics`→Electrónica, `home`→Hogar.
- Every existing test file touching restyled markup gets updated in the same task that changes the markup — never left red, never deleted to "fix" a failure.

---

## Task 1: Design tokens palette

**Files:**
- Modify: `packages/design-tokens/tokens.ts`
- Modify: `packages/design-tokens/README.md`

**Interfaces:**
- Produces: `colors` object with new key names (`sidebar`, `sidebarHover`, `sidebarBorder`, `sidebarForeground`, `bg`, `card`, `border`, `ink`, `inkSoft`, `inkFaint`, `forest`, `forestDark`, `forestTint`, `amber`, `amberInk`, `amberTint`, `amberForeground`, `red`, `redTint`, `blue`, `blueTint`). `spacing` unchanged.
- Consumed by: nothing programmatically today (verified: `apps/web/tailwind.config.ts` only imports `spacing` from this package, not `colors` — the CSS variables in `index.css`, Task 3, are hand-derived from these same hex sources but not actually imported). This task is a documentation/source-of-truth update; Task 3 is where the visual change actually takes effect.

- [ ] **Step 1: Replace `packages/design-tokens/tokens.ts`**

```ts
// Mirrors the RentaTodo dashboard visual redesign mockup (dashboard.html,
// via RentaTodo_Dashboard_Preview.pdf), NOT apps/mobile's current colors —
// see README.md for why these two are now intentionally out of sync.

export const colors = {
  sidebar: '#16231d',
  sidebarHover: '#1f3129',
  sidebarBorder: '#263a30',
  sidebarForeground: '#cfd9d2',
  bg: '#f4f6f4',
  card: '#ffffff',
  border: '#e2e7e3',
  ink: '#16221d',
  inkSoft: '#5c6b64',
  inkFaint: '#94a39c',
  forest: '#2f6f4e',
  forestDark: '#234f39',
  forestTint: '#e7f1ea',
  amber: '#d98c2b',
  amberInk: '#241505',
  amberTint: '#fbeed9',
  amberForeground: '#9c6114',
  red: '#c0442e',
  redTint: '#f8e4df',
  blue: '#3563a8',
  blueTint: '#e4ebf6',
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

- [ ] **Step 2: Replace `packages/design-tokens/README.md`**

```markdown
# @rentatodo/design-tokens

Shared color and spacing values for RentaTodo's owner dashboard (`apps/web`,
Tailwind CSS) and renter app (`apps/mobile`, NativeWind).

## Usage from Tailwind (apps/web)

```ts
import { colors, spacing } from '@rentatodo/design-tokens';
```

See `apps/web/tailwind.config.ts` for how the spacing scale is consumed, and
`apps/web/src/index.css` for how the colors are turned into shadcn/ui's CSS
variables.

## apps/mobile is currently OUT OF SYNC with these colors

As of the 2026-07-15 dashboard visual redesign, this package's `colors` were
updated to match a new mockup (forest green / dark sidebar palette),
replacing the original teal/ink palette that was sourced from
`apps/mobile/src/constants/brand.ts`. **`apps/mobile` was not updated** —
it still uses the old teal palette. The two apps' visual identities are
intentionally diverged for now. Whoever next touches `apps/mobile`'s theming
should either update `apps/mobile/src/constants/brand.ts` to match this
package's current colors, or treat the divergence as a deliberate product
decision and leave it alone — but should not assume the two are in sync.
```

- [ ] **Step 3: Verify**

Run: `pnpm install && pnpm --filter @rentatodo/web build`
Expected: exits 0 (this task doesn't change anything the build actually consumes yet, per the Interfaces note above — this just confirms nothing broke).

- [ ] **Step 4: Commit**

```bash
git add packages/design-tokens
git commit -m "feat(design-tokens): update palette to the dashboard redesign mockup"
```

---

## Task 2: Fonts and Tailwind config

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/tailwind.config.ts`

**Interfaces:**
- Produces: `font-display`, `font-sans`, `font-mono` Tailwind utilities backed by Space Grotesk/Inter/JetBrains Mono. New color keys `warning`, `warning-ink`, `warning-tint`, `warning-foreground`, `info`, `info-tint`, `destructive-tint` (all `hsl(var(--x))`-wrapped). The existing `sidebar.*` keys are untouched (already correctly wired to `--sidebar-*` variables — this task doesn't need to add them, Task 3 just needs to populate those variables).

- [ ] **Step 1: Replace `apps/web/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <title>RentaTodo — Dashboard del Dueño</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `apps/web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'
import { spacing } from '@rentatodo/design-tokens'

const pxSpacing = Object.fromEntries(
  Object.entries(spacing).map(([key, value]) => [key, `${value}px`]),
)

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      spacing: pxSpacing,
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        'destructive-tint': 'hsl(var(--destructive-tint))',
        warning: 'hsl(var(--warning))',
        'warning-ink': 'hsl(var(--warning-ink))',
        'warning-tint': 'hsl(var(--warning-tint))',
        'warning-foreground': 'hsl(var(--warning-foreground))',
        info: 'hsl(var(--info))',
        'info-tint': 'hsl(var(--info-tint))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @rentatodo/web build`
Expected: exits 0. The new color/font keys aren't consumed by any component yet (Task 3 defines their CSS variable values; Tasks 4+ use the classes) — this step only confirms the config itself is syntactically valid and the build's PostCSS/Tailwind pass doesn't error on the new keys referencing not-yet-defined CSS variables (Tailwind doesn't validate that a `var(--x)` reference resolves at build time, only at runtime in the browser, so this is expected to pass even before Task 3).

- [ ] **Step 4: Commit**

```bash
git add apps/web/index.html apps/web/tailwind.config.ts
git commit -m "feat(web): add Space Grotesk/Inter/JetBrains Mono fonts and new status colors to Tailwind config"
```

---

## Task 3: shadcn CSS variables

**Files:**
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Produces: every CSS variable listed in this plan's Global Constraints section, defined in `:root`. `.dark` block untouched.

- [ ] **Step 1: Replace the `:root` block in `apps/web/src/index.css`** (leave `.dark` and the final `@layer base` block below it exactly as they are)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
@layer base {
  :root {
    --background: 120 10% 96%;         /* bg #f4f6f4 */
    --foreground: 155 21% 11%;         /* ink #16221d */
    --card: 0 0% 100%;                 /* card #ffffff */
    --card-foreground: 155 21% 11%;    /* ink */
    --popover: 0 0% 100%;              /* card */
    --popover-foreground: 155 21% 11%; /* ink */
    --primary: 149 41% 31%;            /* forest #2f6f4e */
    --primary-foreground: 0 0% 100%;   /* white text on forest */
    --secondary: 138 26% 93%;          /* forest-tint #e7f1ea */
    --secondary-foreground: 150 39% 22%; /* forest-dark #234f39 */
    --muted: 132 9% 90%;               /* border #e2e7e3 */
    --muted-foreground: 152 8% 39%;    /* ink-soft #5c6b64 */
    --accent: 138 26% 93%;             /* forest-tint */
    --accent-foreground: 150 39% 22%;  /* forest-dark */
    --destructive: 9 61% 47%;          /* red #c0442e */
    --destructive-foreground: 0 0% 100%; /* white */
    --destructive-tint: 12 64% 92%;    /* red-tint #f8e4df */
    --warning: 33 70% 51%;             /* amber #d98c2b, solid fill */
    --warning-ink: 31 76% 8%;          /* amber-ink #241505, text on solid --warning */
    --warning-tint: 37 81% 92%;        /* amber-tint #fbeed9 */
    --warning-foreground: 34 77% 35%;  /* amber-foreground #9c6114, text on --warning-tint */
    --info: 216 52% 43%;               /* blue #3563a8 */
    --info-tint: 217 50% 93%;          /* blue-tint #e4ebf6 */
    --border: 132 9% 90%;              /* border */
    --input: 132 9% 90%;               /* border */
    --ring: 149 41% 31%;               /* forest */
    --sidebar: 152 23% 11%;            /* sidebar #16231d */
    --sidebar-foreground: 138 12% 83%; /* sidebar-foreground #cfd9d2 */
    --sidebar-primary: 149 41% 31%;    /* forest, active nav item bg */
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 153 23% 16%;     /* sidebar-hover #1f3129 */
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 150 21% 19%;     /* sidebar-border #263a30 */
    --sidebar-ring: 149 41% 31%;       /* forest */
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

Run: `pnpm --filter @rentatodo/web test -- --run` then `pnpm --filter @rentatodo/web build`
Expected: all existing tests still pass (the existing `Button` test only asserts the `bg-primary` class is present, not a specific color value, so it's unaffected by the value swap; the `App.test.tsx` integration test doesn't inspect colors). Build exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat(web): apply the redesign's forest-green palette to shadcn CSS variables"
```

---

## Task 4: StatusBadge component

**Files:**
- Create: `apps/web/src/components/StatusBadge.tsx`
- Test: `apps/web/src/components/StatusBadge.test.tsx`

**Interfaces:**
- Consumes: `ReservationStatus` from `@/lib/types`, the `bg-warning-tint`/`bg-info-tint`/`bg-destructive-tint`/etc. classes from Tasks 2-3.
- Produces: `StatusBadge({ status: ReservationStatus })` — a `<span>` with the Spanish label and color classes from this plan's Global Constraints table. Consumed by Tasks 13-15 (`RequestsPage`, `ItemDetailPage`, `ReservationDetailPage`).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/StatusBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the Spanish label and warning colors for a requested reservation', () => {
    render(<StatusBadge status="requested" />)
    const badge = screen.getByText('Solicitada')
    expect(badge).toHaveClass('bg-warning-tint')
    expect(badge).toHaveClass('text-warning-foreground')
  })

  it('renders the Spanish label and destructive-tint colors for a rejected reservation', () => {
    render(<StatusBadge status="rejected" />)
    const badge = screen.getByText('Rechazada')
    expect(badge).toHaveClass('bg-destructive-tint')
    expect(badge).toHaveClass('text-destructive')
  })

  it('renders a distinct, non-empty Spanish label for every reservation status', () => {
    const statuses = ['requested', 'approved', 'delivered', 'returned', 'closed', 'rejected', 'cancelled'] as const
    const labels = new Set<string>()
    for (const status of statuses) {
      const { unmount, container } = render(<StatusBadge status={status} />)
      const text = container.textContent ?? ''
      expect(text.length).toBeGreaterThan(0)
      labels.add(text)
      unmount()
    }
    expect(labels.size).toBe(statuses.length)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- StatusBadge.test`
Expected: FAIL — `Cannot find module './StatusBadge'`.

- [ ] **Step 3: Create `apps/web/src/components/StatusBadge.tsx`**

```tsx
import type { ReservationStatus } from '@/lib/types'

const STATUS_LABELS: Record<ReservationStatus, string> = {
  requested: 'Solicitada',
  approved: 'Aprobada',
  delivered: 'Entregada',
  returned: 'Devuelta',
  closed: 'Cerrada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
}

const STATUS_CLASSES: Record<ReservationStatus, string> = {
  requested: 'bg-warning-tint text-warning-foreground',
  approved: 'bg-secondary text-secondary-foreground',
  delivered: 'bg-info-tint text-info',
  returned: 'bg-info-tint text-info',
  closed: 'bg-muted text-muted-foreground',
  rejected: 'bg-destructive-tint text-destructive',
  cancelled: 'bg-destructive-tint text-destructive',
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-two py-half text-xs font-bold uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- StatusBadge.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/StatusBadge.tsx apps/web/src/components/StatusBadge.test.tsx
git commit -m "feat(web): add StatusBadge component with Spanish reservation-status labels"
```

---

## Task 5: Calendar pure-logic module and CalendarMonth component

**Files:**
- Create: `apps/web/src/lib/calendar.ts`
- Test: `apps/web/src/lib/calendar.test.ts`
- Create: `apps/web/src/components/CalendarMonth.tsx`
- Test: `apps/web/src/components/CalendarMonth.test.tsx`

**Interfaces:**
- Produces: `getMonthGridDays(monthStart: Date, today?: Date): CalendarDay[]` (a `CalendarDay` = `{ date: Date; inCurrentMonth: boolean; isToday: boolean }`), `toDateOnlyString(date: Date): string` (`YYYY-MM-DD`), `isDateBooked(dateStr: string, ranges: UnavailableRange[]): boolean`. `CalendarMonth({ monthStart: Date; unavailableDates: UnavailableRange[] })` — a presentational grid consuming the above. Consumed by Task 6 (`ItemCard`'s availability strip, via a separate `lib/availability.ts` built in that task) and Task 14 (`ItemDetailPage`).

- [ ] **Step 1: Write the failing tests for the pure logic**

```ts
// apps/web/src/lib/calendar.test.ts
import { describe, expect, it } from 'vitest'
import { getMonthGridDays, isDateBooked, toDateOnlyString } from './calendar'

describe('getMonthGridDays', () => {
  it('returns a grid padded to complete weeks, with July 2026 starting on Wednesday (3 leading June days)', () => {
    const july2026 = new Date(2026, 6, 1)
    const days = getMonthGridDays(july2026)

    expect(days.length % 7).toBe(0)
    expect(days[0].date.getMonth()).toBe(5) // June
    expect(days[0].date.getDate()).toBe(28)
    expect(days[0].inCurrentMonth).toBe(false)
    expect(days[3].date.getMonth()).toBe(6) // July
    expect(days[3].date.getDate()).toBe(1)
    expect(days[3].inCurrentMonth).toBe(true)
  })

  it('marks the matching date as today', () => {
    const july2026 = new Date(2026, 6, 1)
    const today = new Date(2026, 6, 14)
    const days = getMonthGridDays(july2026, today)
    const day14 = days.find((d) => d.inCurrentMonth && d.date.getDate() === 14)
    expect(day14?.isToday).toBe(true)
  })
})

describe('toDateOnlyString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateOnlyString(new Date(2026, 6, 5))).toBe('2026-07-05')
  })

  it('zero-pads single-digit months and days', () => {
    expect(toDateOnlyString(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

describe('isDateBooked', () => {
  const ranges = [
    { start_date: '2026-07-18', end_date: '2026-07-20' },
    { start_date: '2026-07-25', end_date: '2026-07-27' },
  ]

  it('returns true for a date inside a range', () => {
    expect(isDateBooked('2026-07-19', ranges)).toBe(true)
  })

  it('returns true for a range boundary date', () => {
    expect(isDateBooked('2026-07-18', ranges)).toBe(true)
    expect(isDateBooked('2026-07-27', ranges)).toBe(true)
  })

  it('returns false for a date outside every range', () => {
    expect(isDateBooked('2026-07-21', ranges)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @rentatodo/web test -- calendar.test`
Expected: FAIL — `Cannot find module './calendar'`.

- [ ] **Step 3: Create `apps/web/src/lib/calendar.ts`**

```ts
import type { UnavailableRange } from './types'

export interface CalendarDay {
  date: Date
  inCurrentMonth: boolean
  isToday: boolean
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function getMonthGridDays(monthStart: Date, today: Date = new Date()): CalendarDay[] {
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const firstWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: CalendarDay[] = []

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrevMonth - i)
    cells.push({ date, inCurrentMonth: false, isToday: isSameDay(date, today) })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    cells.push({ date, inCurrentMonth: true, isToday: isSameDay(date, today) })
  }

  const remainder = cells.length % 7
  const trailingCount = remainder === 0 ? 0 : 7 - remainder
  for (let d = 1; d <= trailingCount; d++) {
    const date = new Date(year, month + 1, d)
    cells.push({ date, inCurrentMonth: false, isToday: isSameDay(date, today) })
  }

  return cells
}

export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isDateBooked(dateStr: string, unavailableDates: UnavailableRange[]): boolean {
  return unavailableDates.some((range) => dateStr >= range.start_date && dateStr <= range.end_date)
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- calendar.test`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing test for `CalendarMonth`**

```tsx
// apps/web/src/components/CalendarMonth.test.tsx
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

  it('renders the Spanish month label and marks a booked date', () => {
    render(
      <CalendarMonth
        monthStart={new Date(2026, 6, 1)}
        unavailableDates={[{ start_date: '2026-07-18', end_date: '2026-07-20' }]}
      />,
    )

    expect(screen.getByText('Julio 2026')).toBeInTheDocument()
    expect(screen.getByText('18')).toHaveClass('bg-destructive')
    expect(screen.getByText('17')).not.toHaveClass('bg-destructive')
  })
})
```

- [ ] **Step 6: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- CalendarMonth.test`
Expected: FAIL — `Cannot find module './CalendarMonth'`.

- [ ] **Step 7: Create `apps/web/src/components/CalendarMonth.tsx`**

```tsx
import { getMonthGridDays, isDateBooked, toDateOnlyString } from '@/lib/calendar'
import type { UnavailableRange } from '@/lib/types'

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function CalendarMonth({
  monthStart,
  unavailableDates,
}: {
  monthStart: Date
  unavailableDates: UnavailableRange[]
}) {
  const days = getMonthGridDays(monthStart)
  const label = `${MONTH_LABELS[monthStart.getMonth()]} ${monthStart.getFullYear()}`

  return (
    <div>
      <div className="mb-two font-display text-base font-bold text-foreground">{label}</div>
      <div className="mb-two grid grid-cols-7 text-xs font-semibold uppercase text-info">
        {WEEKDAY_LABELS.map((weekday, index) => (
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

- [ ] **Step 8: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- CalendarMonth.test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/calendar.ts apps/web/src/lib/calendar.test.ts apps/web/src/components/CalendarMonth.tsx apps/web/src/components/CalendarMonth.test.tsx
git commit -m "feat(web): add calendar grid logic and CalendarMonth component"
```

---

## Task 6: Availability-strip logic and ItemCard component

**Files:**
- Create: `apps/web/src/lib/availability.ts`
- Test: `apps/web/src/lib/availability.test.ts`
- Create: `apps/web/src/lib/categoryLabels.ts`
- Create: `apps/web/src/components/ItemCard.tsx`
- Test: `apps/web/src/components/ItemCard.test.tsx`

**Interfaces:**
- Consumes: `isDateBooked`/`toDateOnlyString` from `@/lib/calendar` (Task 5), `mockItemDetail` from `@/lib/mockData`, `formatCentavos` from `@/lib/format`, `Button` from `@/components/ui/button`.
- Produces: `getAvailabilityStrip(unavailableDates, referenceDate?, days?): ('available'|'booked')[]`. `CATEGORY_LABELS: Record<Category, string>` — the one shared source for every page that displays a category, consumed by Tasks 11, 12, and 14 in addition to this task's own `ItemCard`. `ItemCard({ item: Item; onEdit?: (item: Item) => void; onDelete?: (item: Item) => void; readOnly?: boolean })` — extracted from `ItemsPage`'s current inline card markup, now with the 14-day availability strip. Consumed by Task 11 (`ItemsPage`) and Task 12 (`PublishItemPage`'s live preview, with `readOnly`).
- Note on scope: the real mockup shows a "Reactivar" button instead of "Eliminar" for inactive items. This plan keeps the existing, already-approved behavior instead — Editar/Calendario/Eliminar always shown for every item regardless of active state (no new "reactivate" feature is being added; that was never part of any approved task).

- [ ] **Step 1: Write the failing tests for `getAvailabilityStrip`**

```ts
// apps/web/src/lib/availability.test.ts
import { describe, expect, it } from 'vitest'
import { getAvailabilityStrip } from './availability'

describe('getAvailabilityStrip', () => {
  it('returns 14 entries by default', () => {
    const strip = getAvailabilityStrip([], new Date(2026, 6, 1))
    expect(strip).toHaveLength(14)
  })

  it('marks days inside an unavailable range as booked', () => {
    const strip = getAvailabilityStrip(
      [{ start_date: '2026-07-03', end_date: '2026-07-04' }],
      new Date(2026, 6, 1),
    )
    expect(strip[0]).toBe('available') // Jul 1
    expect(strip[2]).toBe('booked') // Jul 3
    expect(strip[3]).toBe('booked') // Jul 4
    expect(strip[4]).toBe('available') // Jul 5
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- availability.test`
Expected: FAIL — `Cannot find module './availability'`.

- [ ] **Step 3: Create `apps/web/src/lib/availability.ts`**

```ts
import { isDateBooked, toDateOnlyString } from './calendar'
import type { UnavailableRange } from './types'

export type AvailabilityDay = 'available' | 'booked'

export function getAvailabilityStrip(
  unavailableDates: UnavailableRange[],
  referenceDate: Date = new Date(),
  days = 14,
): AvailabilityDay[] {
  const strip: AvailabilityDay[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + i)
    strip.push(isDateBooked(toDateOnlyString(date), unavailableDates) ? 'booked' : 'available')
  }
  return strip
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- availability.test`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for `ItemCard`**

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
    expect(screen.getByText('Herramientas')).toBeInTheDocument()
    expect(screen.getByText('Próximos 14 días')).toBeInTheDocument()
  })

  it('shows the inactive message instead of the strip for an inactive item', () => {
    const item = mockItems.find((i) => !i.is_active)!
    render(
      <MemoryRouter>
        <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Inactivo · no visible en búsquedas')).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(onEdit).toHaveBeenCalledWith(item)
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onDelete).toHaveBeenCalledWith(item)
  })

  it('hides all action buttons when readOnly', () => {
    render(
      <MemoryRouter>
        <ItemCard item={mockItems[0]} readOnly />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendario' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- ItemCard.test`
Expected: FAIL — `Cannot find module './ItemCard'`.

- [ ] **Step 7: Create the shared category-label module, `apps/web/src/lib/categoryLabels.ts`**

Four different pages need to render a `Category` as a Spanish label (`ItemCard`, `ItemsPage`, `PublishItemPage`, `ItemDetailPage`). Rather than four copies of the same mapping, this is defined once here and imported everywhere it's needed — starting with `ItemCard` in this task.

```ts
import type { Category } from './types'

export const CATEGORY_LABELS: Record<Category, string> = {
  tools: 'Herramientas',
  photography: 'Fotografía',
  camping: 'Camping',
  sports: 'Deportes',
  electronics: 'Electrónica',
  home: 'Hogar',
}
```

- [ ] **Step 8: Create `apps/web/src/components/ItemCard.tsx`**

```tsx
import { Link } from 'react-router-dom'
import type { Item } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { getAvailabilityStrip } from '@/lib/availability'
import { CATEGORY_LABELS } from '@/lib/categoryLabels'
import { mockItemDetail } from '@/lib/mockData'
import { Button } from '@/components/ui/button'

interface ItemCardProps {
  item: Item
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  readOnly?: boolean
}

export function ItemCard({ item, onEdit, onDelete, readOnly = false }: ItemCardProps) {
  const detail = mockItemDetail(item.id)
  const strip = getAvailabilityStrip(detail?.unavailable_dates ?? [])

  return (
    <div data-testid={`item-card-${item.id}`} className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-secondary to-card">
        <span className="absolute left-two top-two rounded-full bg-foreground/75 px-two py-half text-xs font-semibold capitalize text-card">
          {CATEGORY_LABELS[item.category]}
        </span>
      </div>
      <div className="space-y-two p-three">
        <div className="flex items-start justify-between gap-two">
          <Link to={`/items/${item.id}`} className="font-semibold text-foreground hover:text-primary">
            {item.name}
          </Link>
          <span className="whitespace-nowrap font-mono text-sm font-semibold text-secondary-foreground">
            {formatCentavos(item.price_per_day)}
            <span className="text-xs font-normal text-muted-foreground">/día</span>
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        {item.is_active ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximos 14 días</p>
            <div className="mt-one flex gap-half">
              {strip.map((day, index) => (
                <div key={index} className={`h-4 flex-1 rounded-sm ${day === 'booked' ? 'bg-destructive/65' : 'bg-muted'}`} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">Inactivo · no visible en búsquedas</p>
        )}
        {!readOnly && (
          <div className="flex gap-two pt-one">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit?.(item)}>
              Editar
            </Button>
            <Button size="sm" variant="outline" className="flex-1" asChild>
              <Link to={`/items/${item.id}`}>Calendario</Link>
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => onDelete?.(item)}>
              Eliminar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- ItemCard.test`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/availability.ts apps/web/src/lib/availability.test.ts apps/web/src/lib/categoryLabels.ts apps/web/src/components/ItemCard.tsx apps/web/src/components/ItemCard.test.tsx
git commit -m "feat(web): add availability-strip logic, shared category labels, and ItemCard component"
```

---

## Task 7: DashboardLayout sidebar rewrite

**Files:**
- Modify: `apps/web/src/layouts/DashboardLayout.tsx`
- Modify: `apps/web/src/layouts/DashboardLayout.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (unchanged), `mockRequests`/`mockUser` from `@/lib/mockData`, `Button` from `@/components/ui/button`.
- Produces: same `DashboardLayout` export, now a sidebar instead of a top bar. Nav routes to `/dashboard`, `/items`, `/items/publish`, `/requests`, `/earnings` (all pre-existing except `/items/publish`, registered in Task 17).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/layouts/DashboardLayout.test.tsx
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

    expect(screen.getByRole('link', { name: 'Resumen' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Mis artículos' })).toHaveAttribute('href', '/items')
    expect(screen.getByRole('link', { name: 'Publicar artículo' })).toHaveAttribute('href', '/items/publish')
    expect(screen.getByRole('link', { name: /^Solicitudes/ })).toHaveAttribute('href', '/requests')
    expect(screen.getByRole('link', { name: 'Ganancias' })).toHaveAttribute('href', '/earnings')
    expect(screen.getByText('Home content')).toBeInTheDocument()
  })

  it('shows a pending-request count badge on the Solicitudes link', () => {
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
    const requestsLink = screen.getByRole('link', { name: /^Solicitudes/ })
    expect(requestsLink).toHaveTextContent(/\d+/)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- DashboardLayout.test`
Expected: FAIL — old test asserted English link names (`Dashboard`, `My items`, etc.) that no longer exist once this test file is replaced with the above; running it against the *current* (pre-Task-7) component fails since the new labels don't exist yet.

- [ ] **Step 3: Replace `apps/web/src/layouts/DashboardLayout.tsx`**

```tsx
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { mockRequests, mockUser } from '@/lib/mockData'
import { Button } from '@/components/ui/button'

const NAV_GROUPS = [
  { label: 'Panel', items: [{ to: '/dashboard', label: 'Resumen' }] },
  {
    label: 'Inventario',
    items: [
      { to: '/items', label: 'Mis artículos' },
      { to: '/items/publish', label: 'Publicar artículo' },
    ],
  },
  { label: 'Actividad', items: [{ to: '/requests', label: 'Solicitudes' }] },
  { label: 'Finanzas', items: [{ to: '/earnings', label: 'Ganancias' }] },
]

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
  const pendingCount = mockRequests.filter((r) => r.status === 'requested').length

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
          {NAV_GROUPS.map((group) => (
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
            <div className="text-xs text-sidebar-foreground/60">Dueña</div>
          </div>
        </div>
        <Button variant="outline" className="mt-three" onClick={logout}>
          Cerrar sesión
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
git commit -m "feat(web): rewrite DashboardLayout as a sidebar with Spanish nav"
```

---

## Task 8: Login and Register pages — restyle and Spanish text

**Files:**
- Modify: `apps/web/src/routes/LoginPage.tsx`
- Modify: `apps/web/src/routes/LoginPage.test.tsx`
- Modify: `apps/web/src/routes/RegisterPage.tsx`
- Modify: `apps/web/src/routes/RegisterPage.test.tsx`
- Modify: `apps/web/src/App.test.tsx` (its `Log in` button-name assertion must change to match `LoginPage`'s new Spanish text, or the whole-app integration test breaks)

**Interfaces:**
- No prop/behavior changes — `login()`, `navigate('/dashboard')`, `navigate('/login')` all unchanged. Text only.

- [ ] **Step 1: Write the failing test for `LoginPage`**

```tsx
// apps/web/src/routes/LoginPage.test.tsx
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

    await user.type(screen.getByLabelText('Correo electrónico'), 'maria@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(screen.getByTestId('status')).toHaveTextContent('in')
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- LoginPage.test`
Expected: FAIL — the current component still renders English labels (`Email`, `Password`, `Log in`), so `getByLabelText('Correo electrónico')` etc. don't match anything.

- [ ] **Step 3: Replace `apps/web/src/routes/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
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
        <h1 className="font-display text-lg font-semibold text-foreground">Iniciar sesión</h1>
        <div className="space-y-half">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">
          Iniciar sesión
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run the `LoginPage` test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- LoginPage.test`
Expected: PASS.

- [ ] **Step 5: Update `apps/web/src/App.test.tsx`'s button-name assertion**

Open `apps/web/src/App.test.tsx` and change the single `findByRole('button', { name: 'Log in' })` call to `findByRole('button', { name: 'Iniciar sesión' })`. The rest of the file (imports, the `App` render, the `window.history.pushState` setup) stays exactly as it is.

- [ ] **Step 6: Write the failing test for `RegisterPage`**

```tsx
// apps/web/src/routes/RegisterPage.test.tsx
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

    await user.type(screen.getByLabelText('Nombre'), 'María Vargas')
    await user.type(screen.getByLabelText('Correo electrónico'), 'maria@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- RegisterPage.test`
Expected: FAIL — current component renders English labels.

- [ ] **Step 8: Replace `apps/web/src/routes/RegisterPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterPage() {
  const navigate = useNavigate()
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
        <h1 className="font-display text-lg font-semibold text-foreground">Crear cuenta</h1>
        <div className="space-y-half">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">
          Crear cuenta
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 9: Run all four tests and the full suite**

Run: `pnpm --filter @rentatodo/web test -- --run`
Expected: `LoginPage.test`, `RegisterPage.test`, and `App.test` all pass; full suite green.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/routes/LoginPage.tsx apps/web/src/routes/LoginPage.test.tsx apps/web/src/routes/RegisterPage.tsx apps/web/src/routes/RegisterPage.test.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): translate Login/Register pages to Spanish and restyle"
```

---

## Task 9: Mock data additions

**Files:**
- Modify: `apps/web/src/lib/mockData.ts`

**Interfaces:**
- Appends 2 entries to `mockRequests` (does not modify the existing 3). No type changes.

- [ ] **Step 1: Append two entries to the `mockRequests` array in `apps/web/src/lib/mockData.ts`**, immediately after the existing `returned`-status entry (the array's closing `]` moves to after these two new objects):

```ts
  {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    item_id: mockItems[0].id,
    item_name: mockItems[0].name,
    item_photo_url: mockItems[0].photo_url,
    renter_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    renter_name: 'Sofía Guzmán',
    start_date: '2026-07-01',
    end_date: '2026-07-03',
    status: 'closed',
    deposit_amount: 3000,
    deposit_status: 'released',
    created_at: '2026-06-28T10:00:00Z',
    updated_at: '2026-07-04T09:00:00Z',
  },
  {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    item_id: mockItems[1].id,
    item_name: mockItems[1].name,
    item_photo_url: mockItems[1].photo_url,
    renter_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    renter_name: 'Pablo Díaz',
    start_date: '2026-07-05',
    end_date: '2026-07-06',
    status: 'rejected',
    deposit_amount: 4000,
    deposit_status: 'none',
    created_at: '2026-07-03T11:00:00Z',
    updated_at: '2026-07-03T15:00:00Z',
  },
```

- [ ] **Step 2: Run the full suite and verify nothing regresses**

Run: `pnpm --filter @rentatodo/web test -- --run`
Expected: all existing tests still pass — `RequestsPage.test.tsx` iterates all of `mockRequests` and asserts each renter name appears (now 5 names, still passes since it's a loop, not a fixed count); `ReservationDetailPage.test.tsx` references `mockRequests[1]` by index (unaffected, append-only); `mockData.test.ts` (if present from the original scaffold) asserts category/status enum membership for every entry in a loop (the two new entries use valid enum values, so it still passes).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/mockData.ts
git commit -m "feat(web): add closed and rejected mock reservations for status-badge coverage"
```

---

## Task 10: DashboardPage — KPI cards and recent-requests preview

**Files:**
- Modify: `apps/web/src/routes/DashboardPage.tsx`
- Modify: `apps/web/src/routes/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `mockItems`, `mockRequests`, `mockEarnings`, `mockUser` from `@/lib/mockData`, `Reservation` from `@/lib/types`, `formatCentavos`, `Button`.

- [ ] **Step 1: Write the failing tests**

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

    expect(screen.getByText('Artículos activos')).toBeInTheDocument()
    expect(screen.getByText(String(activeItems))).toBeInTheDocument()
    expect(screen.getByText('Solicitudes pendientes')).toBeInTheDocument()
    expect(screen.getByText(String(pending))).toBeInTheDocument()
  })

  it('shows pending requests and lets you approve one', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    const firstPending = mockRequests.filter((r) => r.status === 'requested')[0]
    const row = screen.getByText(new RegExp(firstPending.renter_name)).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Aprobar' }))
    expect(screen.queryByText(new RegExp(firstPending.renter_name))).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @rentatodo/web test -- DashboardPage.test`
Expected: FAIL — current component only renders `mockUser.name`/`mockUser.email`, none of the new text exists.

- [ ] **Step 3: Replace `apps/web/src/routes/DashboardPage.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mockEarnings, mockItems, mockRequests, mockUser } from '@/lib/mockData'
import type { Reservation } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { Button } from '@/components/ui/button'

export function DashboardPage() {
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
          <h1 className="font-display text-lg font-semibold text-foreground">Resumen</h1>
          <p className="text-sm text-muted-foreground">Bienvenida de vuelta, {mockUser.name.split(' ')[0]}</p>
        </div>
        <Button asChild>
          <Link to="/items/publish">+ Publicar artículo</Link>
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-three">
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Artículos activos</p>
          <p className="font-display text-2xl font-semibold text-foreground">{activeItems}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Solicitudes pendientes</p>
          <p className="font-display text-2xl font-semibold text-foreground">{pendingRequests.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Reservas activas</p>
          <p className="font-display text-2xl font-semibold text-foreground">{activeReservations}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Ganado este mes</p>
          <p className="font-display text-2xl font-semibold text-foreground">{formatCentavos(mockEarnings.total_earnings)}</p>
        </div>
      </div>

      <div>
        <div className="mb-two flex items-center justify-between">
          <div>
            <h2 className="font-medium text-foreground">Solicitudes recientes</h2>
            <p className="text-sm text-muted-foreground">Lo último que necesita tu atención</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/requests">Ver todas</Link>
          </Button>
        </div>
        <ul className="space-y-two">
          {recentPending.map((reservation) => (
            <li key={reservation.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-three">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {reservation.renter_name} solicitó {reservation.item_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reservation.start_date} — {reservation.end_date} · {formatCentavos(reservation.deposit_amount)} total
                </p>
              </div>
              <div className="flex gap-two">
                <Button size="sm" variant="outline" onClick={() => setStatus(reservation.id, 'rejected')}>
                  Rechazar
                </Button>
                <Button size="sm" onClick={() => setStatus(reservation.id, 'approved')}>
                  Aprobar
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

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- DashboardPage.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/DashboardPage.tsx apps/web/src/routes/DashboardPage.test.tsx
git commit -m "feat(web): add dashboard KPI cards and recent-requests preview"
```

---

## Task 11: ItemsPage — use ItemCard, drop the create dialog

**Files:**
- Modify: `apps/web/src/routes/ItemsPage.tsx`
- Modify: `apps/web/src/routes/ItemsPage.test.tsx`

**Interfaces:**
- Consumes: `ItemCard` (Task 6). The create-item Dialog is removed — "Publicar artículo" now navigates to `/items/publish` (Task 12). The edit-item Dialog stays, restyled/translated.

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/routes/ItemsPage.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemsPage } from './ItemsPage'

describe('ItemsPage', () => {
  it('lists every mock item, marking inactive ones', () => {
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    for (const item of mockItems) {
      expect(screen.getByText(item.name)).toBeInTheDocument()
    }
    expect(screen.getByText('Inactivo · no visible en búsquedas')).toBeInTheDocument()
  })

  it('edits an existing item through the pre-filled dialog', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    const target = mockItems[0]
    const card = screen.getByTestId(`item-card-${target.id}`)
    await user.click(within(card).getByRole('button', { name: 'Editar' }))

    const nameInput = screen.getByLabelText('Nombre del artículo')
    await user.clear(nameInput)
    await user.type(nameInput, 'Taladro Bosch Professional (renovado)')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(screen.getByText('Taladro Bosch Professional (renovado)')).toBeInTheDocument()
  })

  it('soft-deletes an item after confirming, without removing it from the list', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    const target = mockItems.find((item) => item.is_active)!
    const card = screen.getByTestId(`item-card-${target.id}`)
    await user.click(within(card).getByRole('button', { name: 'Eliminar' }))

    expect(screen.getByText(target.name)).toBeInTheDocument()
    expect(within(card).getByText('Inactivo · no visible en búsquedas')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @rentatodo/web test -- ItemsPage.test`
Expected: FAIL — current component doesn't render `data-testid="item-card-..."` elements, uses English button text, and the delete confirm message differs.

- [ ] **Step 3: Replace `apps/web/src/routes/ItemsPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockItems } from '@/lib/mockData'
import type { Category, Item } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/categoryLabels'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ItemCard } from '@/components/ItemCard'

const CATEGORIES: Category[] = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home']

export function ItemsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[]>(mockItems)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [form, setForm] = useState({ name: '', description: '', category: CATEGORIES[0], priceDollars: '', photoUrl: '' })

  function openEditDialog(item: Item) {
    setEditingItem(item)
    setForm({
      name: item.name,
      description: item.description,
      category: item.category,
      priceDollars: String(item.price_per_day / 100),
      photoUrl: item.photo_url,
    })
  }

  function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editingItem) return
    const priceCentavos = Math.round(Number(form.priceDollars) * 100)
    setItems((current) =>
      current.map((item) =>
        item.id === editingItem.id
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
    setEditingItem(null)
  }

  function handleDelete(item: Item) {
    // Phase 1: no real DELETE /items/{id} call yet — mirrors the API's soft
    // delete (is_active: false), never removes the row.
    const confirmed = window.confirm(`¿Eliminar "${item.name}"? Dejará de aparecer en la búsqueda pública.`)
    if (!confirmed) return
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, is_active: false } : i)))
  }

  return (
    <div className="space-y-three">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground">Mis artículos</h1>
          <p className="text-sm text-muted-foreground">
            {items.filter((i) => i.is_active).length} publicados · {items.filter((i) => !i.is_active).length} inactivo
          </p>
        </div>
        <Button onClick={() => navigate('/items/publish')}>+ Publicar artículo</Button>
      </div>

      <div className="grid grid-cols-1 gap-four sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onEdit={openEditDialog} onDelete={handleDelete} />
        ))}
      </div>

      <Dialog open={editingItem !== null} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar artículo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-two">
            <div className="space-y-half">
              <Label htmlFor="item-name">Nombre del artículo</Label>
              <Input id="item-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-half">
              <Label htmlFor="item-description">Descripción</Label>
              <Input
                id="item-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-half">
              <Label htmlFor="item-category">Categoría</Label>
              <select
                id="item-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
                className="w-full rounded-md border border-input bg-card px-two py-half text-foreground"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-half">
              <Label htmlFor="item-price">Precio por día (USD)</Label>
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
              <Label htmlFor="item-photo">URL de la foto</Label>
              <Input
                id="item-photo"
                type="url"
                value={form.photoUrl}
                onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Guardar cambios
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- ItemsPage.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/ItemsPage.tsx apps/web/src/routes/ItemsPage.test.tsx
git commit -m "feat(web): rewrite ItemsPage to use ItemCard and move publish to its own page"
```

---

## Task 12: PublishItemPage (new route)

**Files:**
- Create: `apps/web/src/routes/PublishItemPage.tsx`
- Test: `apps/web/src/routes/PublishItemPage.test.tsx`

**Interfaces:**
- Consumes: `mockItems` (mutated via `.push` — see note below), `mockUser`, `Category`/`Item` types, `ItemCard` (`readOnly`).
- Produces: `PublishItemPage` — registered at `/items/publish` in Task 17.
- **Note on shared mock state:** `handleSubmit` pushes the new item directly onto the imported `mockItems` array (not through a `useState` copy), so that navigating to `/items` afterward shows it — `ItemsPage` re-seeds its own local state from `mockItems` fresh on every mount. This is a deliberate Phase 1 simplification (no global store exists), separate from `ItemsPage`'s own local edit/delete state, which only affects that component's local copy and does not persist across navigation. This asymmetry is intentional: only "publish" needs to persist across the page boundary for the demo to make sense; edits/deletes reverting on remount is an accepted Phase 1 limitation, same as the rest of this mock-only app.

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/routes/PublishItemPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PublishItemPage } from './PublishItemPage'
import { ItemsPage } from './ItemsPage'

function renderPublishFlow() {
  return render(
    <MemoryRouter initialEntries={['/items/publish']}>
      <Routes>
        <Route path="/items/publish" element={<PublishItemPage />} />
        <Route path="/items" element={<ItemsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublishItemPage', () => {
  it('updates the live preview as the form is filled', async () => {
    const user = userEvent.setup()
    renderPublishFlow()

    await user.type(screen.getByLabelText('Nombre del artículo'), 'Bicicleta de montaña')
    expect(screen.getByText('Bicicleta de montaña')).toBeInTheDocument()
  })

  it('publishing navigates to /items and shows the new item in the list', async () => {
    const user = userEvent.setup()
    renderPublishFlow()

    await user.type(screen.getByLabelText('Nombre del artículo'), 'Bicicleta de montaña de prueba')
    await user.type(screen.getByLabelText('Descripción'), 'Rodado 29, frenos de disco')
    await user.type(screen.getByLabelText('Precio por día'), '12')
    await user.type(screen.getByLabelText('URL de la foto'), 'https://storage.example.com/photos/bici.jpg')
    await user.click(screen.getByRole('button', { name: 'Publicar artículo' }))

    expect(await screen.findByText('Bicicleta de montaña de prueba')).toBeInTheDocument()
  })

  it('Cancel navigates back to /items without publishing', async () => {
    const user = userEvent.setup()
    renderPublishFlow()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText('Mis artículos')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @rentatodo/web test -- PublishItemPage.test`
Expected: FAIL — `Cannot find module './PublishItemPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/PublishItemPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockItems, mockUser } from '@/lib/mockData'
import type { Category, Item } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/categoryLabels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ItemCard } from '@/components/ItemCard'

const CATEGORIES: Category[] = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home']

export function PublishItemPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category>(CATEGORIES[0])
  const [priceDollars, setPriceDollars] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const newItem: Item = {
      id: crypto.randomUUID(),
      name,
      description,
      category,
      price_per_day: Math.round(Number(priceDollars) * 100),
      photo_url: photoUrl,
      is_active: true,
      owner_id: mockUser.id,
      owner_name: mockUser.name,
      created_at: new Date().toISOString(),
    }
    // Phase 1: no real POST /items call yet — appends to the shared mock
    // array in place so it shows up on /items after navigating back.
    mockItems.push(newItem)
    navigate('/items')
  }

  const previewItem: Item = {
    id: 'preview',
    name: name || 'Nombre del artículo',
    description: description || 'Descripción del artículo',
    category,
    price_per_day: Math.round(Number(priceDollars || '0') * 100),
    photo_url: photoUrl,
    is_active: true,
    owner_id: mockUser.id,
    owner_name: mockUser.name,
    created_at: new Date().toISOString(),
  }

  return (
    <div className="space-y-three">
      <div>
        <h1 className="font-display text-lg font-semibold text-foreground">Publicar artículo</h1>
        <p className="text-sm text-muted-foreground">Se guarda como activo y visible de inmediato</p>
      </div>

      <div className="grid grid-cols-1 gap-four lg:grid-cols-[1fr_340px]">
        <form onSubmit={handleSubmit} className="space-y-three rounded-lg border border-border bg-card p-four">
          <div className="space-y-half">
            <Label htmlFor="item-name">Nombre del artículo</Label>
            <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-three">
            <div className="space-y-half">
              <Label htmlFor="item-category">Categoría</Label>
              <select
                id="item-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full rounded-md border border-input bg-card px-two py-half text-foreground"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-half">
              <Label htmlFor="item-price">Precio por día</Label>
              <Input
                id="item-price"
                type="number"
                min={0.01}
                step={0.01}
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-half">
            <Label htmlFor="item-description">Descripción</Label>
            <textarea
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20 w-full rounded-md border border-input bg-card px-two py-half text-foreground"
              required
            />
          </div>
          <div className="space-y-half">
            <Label htmlFor="item-photo">URL de la foto</Label>
            <Input id="item-photo" type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} required />
          </div>
          <div className="flex gap-two">
            <Button type="submit">Publicar artículo</Button>
            <Button type="button" variant="outline" onClick={() => navigate('/items')}>
              Cancelar
            </Button>
          </div>
        </form>

        <div>
          <p className="mb-two text-xs font-semibold uppercase tracking-wide text-muted-foreground">Así se va a ver</p>
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
git commit -m "feat(web): add dedicated PublishItemPage with live preview"
```

---

## Task 13: RequestsPage — StatusBadge and Spanish text

**Files:**
- Modify: `apps/web/src/routes/RequestsPage.tsx`
- Modify: `apps/web/src/routes/RequestsPage.test.tsx`

**Interfaces:**
- Consumes: `StatusBadge` (Task 4).

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/routes/RequestsPage.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockRequests } from '@/lib/mockData'
import { RequestsPage } from './RequestsPage'

describe('RequestsPage', () => {
  it('lists renter name and dates for each request', () => {
    render(
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>,
    )
    for (const reservation of mockRequests) {
      expect(screen.getByText(reservation.renter_name)).toBeInTheDocument()
    }
  })

  it('approving a requested reservation updates its badge to Aprobada', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>,
    )

    const requested = mockRequests.find((r) => r.status === 'requested')!
    const row = screen.getByText(requested.renter_name).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Aprobar' }))

    expect(within(row).getByText('Aprobada')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @rentatodo/web test -- RequestsPage.test`
Expected: FAIL — current component uses English button text (`Approve`) and renders the raw status string, not `Aprobada`.

- [ ] **Step 3: Replace `apps/web/src/routes/RequestsPage.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mockRequests } from '@/lib/mockData'
import type { Reservation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function RequestsPage() {
  const [requests, setRequests] = useState<Reservation[]>(mockRequests)

  function setStatus(id: string, status: Reservation['status']) {
    setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  return (
    <div className="space-y-three">
      <h1 className="font-display text-lg font-semibold text-foreground">Solicitudes</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Arrendatario</TableHead>
            <TableHead>Fechas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((reservation) => (
            <TableRow key={reservation.id}>
              <TableCell>
                <Link to={`/reservations/${reservation.id}`} className="hover:text-primary hover:underline">
                  {reservation.renter_name}
                </Link>
              </TableCell>
              <TableCell>
                {reservation.start_date} → {reservation.end_date}
              </TableCell>
              <TableCell>
                <StatusBadge status={reservation.status} />
              </TableCell>
              <TableCell className="space-x-two">
                {reservation.status === 'requested' && (
                  <>
                    <Button size="sm" onClick={() => setStatus(reservation.id, 'approved')}>
                      Aprobar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setStatus(reservation.id, 'rejected')}>
                      Rechazar
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- RequestsPage.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/RequestsPage.tsx apps/web/src/routes/RequestsPage.test.tsx
git commit -m "feat(web): use StatusBadge and Spanish text on RequestsPage"
```

---

## Task 14: ItemDetailPage — two-month calendar and renter history

**Files:**
- Modify: `apps/web/src/routes/ItemDetailPage.tsx`
- Modify: `apps/web/src/routes/ItemDetailPage.test.tsx`

**Interfaces:**
- Consumes: `CalendarMonth` (Task 5), `StatusBadge` (Task 4), `mockRequests` (filtered by `item_id`), `ChevronLeft`/`ChevronRight` from `lucide-react` (already a dependency since the original scaffold's Task 6).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/ItemDetailPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockItems, mockRequests } from '@/lib/mockData'
import { ItemDetailPage } from './ItemDetailPage'

describe('ItemDetailPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 14))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the item, a two-month calendar, and links reservations to their detail page', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const item = mockItems[0]
    render(
      <MemoryRouter initialEntries={[`/items/${item.id}`]}>
        <Routes>
          <Route path="/items/:id" element={<ItemDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(item.name)).toBeInTheDocument()
    expect(screen.getByText('Julio 2026')).toBeInTheDocument()
    expect(screen.getByText('Agosto 2026')).toBeInTheDocument()

    const relatedReservation = mockRequests.find((r) => r.item_id === item.id)!
    const link = screen.getByRole('link', { name: new RegExp(relatedReservation.renter_name) })
    expect(link).toHaveAttribute('href', `/reservations/${relatedReservation.id}`)

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))

    expect(screen.getByText('Agosto 2026')).toBeInTheDocument()
    expect(screen.getByText('Septiembre 2026')).toBeInTheDocument()
    expect(screen.queryByText('Julio 2026')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- ItemDetailPage.test`
Expected: FAIL — current component only renders a chip-list of unavailable dates, no month labels, no renter-history links.

- [ ] **Step 3: Replace `apps/web/src/routes/ItemDetailPage.tsx`**

```tsx
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { mockItemDetail, mockRequests } from '@/lib/mockData'
import { CATEGORY_LABELS } from '@/lib/categoryLabels'
import { formatCentavos } from '@/lib/format'
import { CalendarMonth } from '@/components/CalendarMonth'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const item = id ? mockItemDetail(id) : undefined
  const [windowStart, setWindowStart] = useState(() => startOfMonth(new Date()))

  if (!item) {
    return <p className="text-muted-foreground">Artículo no encontrado.</p>
  }

  const reservations = mockRequests.filter((r) => r.item_id === item.id)
  const secondMonth = addMonths(windowStart, 1)

  return (
    <div className="space-y-four">
      <div>
        <h1 className="font-display text-lg font-semibold text-foreground">{item.name}</h1>
        <p className="text-foreground">{item.description}</p>
        <p className="text-muted-foreground">
          {CATEGORY_LABELS[item.category]} · {formatCentavos(item.price_per_day)}/día
        </p>
      </div>

      <div className="max-w-3xl rounded-lg border border-border bg-card p-four">
        <div className="mb-three flex items-center justify-between">
          <h2 className="font-medium text-foreground">Disponibilidad</h2>
          <div className="flex gap-two">
            <Button
              variant="outline"
              size="icon"
              aria-label="Mes anterior"
              onClick={() => setWindowStart((current) => addMonths(current, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Mes siguiente"
              onClick={() => setWindowStart((current) => addMonths(current, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-9">
          <CalendarMonth monthStart={windowStart} unavailableDates={item.unavailable_dates} />
          <CalendarMonth monthStart={secondMonth} unavailableDates={item.unavailable_dates} />
        </div>
      </div>

      <div>
        <h2 className="font-medium text-foreground">Reservas de este artículo</h2>
        <ul className="space-y-two">
          {reservations.map((reservation) => (
            <li key={reservation.id} className="flex items-center justify-between rounded-md border border-border bg-card p-three">
              <Link to={`/reservations/${reservation.id}`} className="hover:text-primary hover:underline">
                {reservation.renter_name} — {reservation.start_date} – {reservation.end_date}
              </Link>
              <StatusBadge status={reservation.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- ItemDetailPage.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/ItemDetailPage.tsx apps/web/src/routes/ItemDetailPage.test.tsx
git commit -m "feat(web): replace ItemDetailPage's date-chip list with a working two-month calendar and renter history"
```

---

## Task 15: ReservationDetailPage — restyle and StatusBadge

**Files:**
- Modify: `apps/web/src/routes/ReservationDetailPage.tsx`
- Modify: `apps/web/src/routes/ReservationDetailPage.test.tsx`

**Interfaces:**
- Consumes: `StatusBadge` (Task 4). No behavior changes — same close-button gating, same report form, same deposit-history table.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/ReservationDetailPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockRequests, mockTransactions } from '@/lib/mockData'
import { ReservationDetailPage } from './ReservationDetailPage'

describe('ReservationDetailPage', () => {
  it('renders the status badge, transaction history, and a report-problem form', async () => {
    const user = userEvent.setup()
    const reservation = mockRequests[1]
    render(
      <MemoryRouter initialEntries={[`/reservations/${reservation.id}`]}>
        <Routes>
          <Route path="/reservations/:id" element={<ReservationDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Entregada')).toBeInTheDocument()
    expect(screen.getByText('Retención')).toBeInTheDocument()
    expect(screen.getByText(mockTransactions[0].amount === 4500 ? '$45.00' : String(mockTransactions[0].amount))).toBeInTheDocument()

    await user.type(screen.getByLabelText('¿Qué salió mal?'), 'El taladro llegó dañado')
    await user.type(screen.getByLabelText('URL de la foto'), 'https://storage.example.com/photos/broken.jpg')
    await user.click(screen.getByRole('button', { name: 'Enviar reporte' }))

    expect(screen.getByText('Reporte enviado.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- ReservationDetailPage.test`
Expected: FAIL — current component renders the raw English status string and English labels/button text.

- [ ] **Step 3: Replace `apps/web/src/routes/ReservationDetailPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { mockRequests, mockTransactions } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const TRANSACTION_LABELS: Record<string, string> = {
  hold: 'Retención',
  release: 'Liberación',
  freeze: 'Congelamiento',
}

export function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const reservation = mockRequests.find((r) => r.id === id)
  const transactions = mockTransactions.filter((tx) => tx.reservation_id === id)
  const [reason, setReason] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)

  if (!reservation) {
    return <p className="text-muted-foreground">Reserva no encontrada.</p>
  }

  function handleClose() {
    // Phase 1: no real PATCH /reservations/{id}/close call yet.
    window.alert('Reserva cerrada (placeholder — sin llamada a la API todavía).')
  }

  function handleReportSubmit(event: FormEvent) {
    event.preventDefault()
    // Phase 1: no real POST /reservations/{id}/report call yet.
    setReportSubmitted(true)
  }

  return (
    <div className="space-y-four">
      <div>
        <div className="flex items-center gap-two">
          <h1 className="font-display text-lg font-semibold text-foreground">{reservation.item_name}</h1>
          <StatusBadge status={reservation.status} />
        </div>
        <p className="text-muted-foreground">
          {reservation.start_date} → {reservation.end_date}
        </p>
        <Button className="mt-two" onClick={handleClose} disabled={reservation.status !== 'returned'}>
          Cerrar reserva
        </Button>
      </div>

      <div>
        <h2 className="font-medium text-foreground">Historial de depósito</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{TRANSACTION_LABELS[tx.type]}</TableCell>
                <TableCell>{formatCentavos(tx.amount)}</TableCell>
                <TableCell>{tx.created_at}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="font-medium text-foreground">Reportar un problema</h2>
        {reportSubmitted ? (
          <p className="text-foreground">Reporte enviado.</p>
        ) : (
          <form onSubmit={handleReportSubmit} className="space-y-two">
            <div className="space-y-half">
              <Label htmlFor="report-reason">¿Qué salió mal?</Label>
              <Input id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
            <div className="space-y-half">
              <Label htmlFor="report-photo">URL de la foto</Label>
              <Input id="report-photo" type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} required />
            </div>
            <Button type="submit">Enviar reporte</Button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- ReservationDetailPage.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/ReservationDetailPage.tsx apps/web/src/routes/ReservationDetailPage.test.tsx
git commit -m "feat(web): use StatusBadge and Spanish text on ReservationDetailPage"
```

---

## Task 16: EarningsPage — side-by-side layout and stat cards

**Files:**
- Modify: `apps/web/src/routes/EarningsPage.tsx`
- Modify: `apps/web/src/routes/EarningsPage.test.tsx`

**Interfaces:**
- Consumes: `mockEarnings`, `mockRequests` (for the "closed reservations" stat).

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/routes/EarningsPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { EarningsPage } from './EarningsPage'

describe('EarningsPage', () => {
  it('shows the total and the first item selected by default', () => {
    render(<EarningsPage />)
    expect(screen.getAllByText(formatCentavos(mockEarnings.total_earnings)).length).toBeGreaterThan(0)
    const firstItem = mockEarnings.by_item[0]
    const firstRental = firstItem.rentals[0]
    expect(screen.getByText(`${firstRental.start_date} — ${firstRental.end_date}`)).toBeInTheDocument()
  })

  it('selecting a different item updates the breakdown panel', async () => {
    const user = userEvent.setup()
    render(<EarningsPage />)

    const secondItem = mockEarnings.by_item[1]
    await user.click(screen.getByRole('button', { name: new RegExp(secondItem.item_name) }))

    const secondRental = secondItem.rentals[0]
    expect(screen.getByText(`${secondRental.start_date} — ${secondRental.end_date}`)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @rentatodo/web test -- EarningsPage.test`
Expected: FAIL — current component uses an expand/collapse list with `-`-separated date ranges (`start - end`), not the em-dash-separated (`—`) side-by-side layout this test expects.

- [ ] **Step 3: Replace `apps/web/src/routes/EarningsPage.tsx`**

```tsx
import { useState } from 'react'
import { mockEarnings, mockRequests } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'

export function EarningsPage() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(mockEarnings.by_item[0]?.item_id ?? null)
  const selected = mockEarnings.by_item.find((byItem) => byItem.item_id === selectedItemId)
  const closedReservations = mockRequests.filter((r) => r.status === 'closed').length

  return (
    <div className="space-y-four">
      <h1 className="font-display text-lg font-semibold text-foreground">Ganancias</h1>

      <div className="grid grid-cols-3 gap-three">
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Ganado en total</p>
          <p className="font-display text-2xl font-semibold text-foreground">{formatCentavos(mockEarnings.total_earnings)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Este mes</p>
          <p className="font-display text-2xl font-semibold text-foreground">{formatCentavos(mockEarnings.total_earnings)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Reservas cerradas</p>
          <p className="font-display text-2xl font-semibold text-foreground">{closedReservations}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-four lg:grid-cols-2">
        <div>
          <h2 className="mb-two font-medium text-foreground">Por artículo</h2>
          <ul className="space-y-two">
            {mockEarnings.by_item.map((byItem) => (
              <li key={byItem.item_id}>
                <button
                  type="button"
                  onClick={() => setSelectedItemId(byItem.item_id)}
                  className={`flex w-full items-center justify-between rounded-lg border bg-card p-three text-left transition-colors ${
                    selectedItemId === byItem.item_id ? 'border-primary ring-1 ring-inset ring-primary' : 'border-border'
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">{byItem.item_name}</span>
                  <span className="font-mono text-sm font-semibold text-secondary-foreground">{formatCentavos(byItem.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selected && (
          <div className="rounded-lg border border-border bg-card p-four">
            <h3 className="font-medium text-foreground">{selected.item_name}</h3>
            <p className="mb-three text-sm text-muted-foreground">Desglose por rango de fechas — sin identificar al arrendatario</p>
            <ul className="divide-y divide-border">
              {selected.rentals.map((rental) => (
                <li key={`${rental.start_date}-${rental.end_date}`} className="flex justify-between py-two text-sm">
                  <span className="font-mono text-muted-foreground">
                    {rental.start_date} — {rental.end_date}
                  </span>
                  <span className="font-mono font-semibold text-foreground">{formatCentavos(rental.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- EarningsPage.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/EarningsPage.tsx apps/web/src/routes/EarningsPage.test.tsx
git commit -m "feat(web): rework EarningsPage as a side-by-side selection layout with stat cards"
```

---

## Task 17: Router wiring and final integration

**Files:**
- Modify: `apps/web/src/routes/index.tsx`

**Interfaces:**
- Registers `/items/publish` → `PublishItemPage` (Task 12), nested under the same `RequireAuth`-wrapped `DashboardLayout` parent as every other protected route.

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
import { ItemDetailPage } from './ItemDetailPage'
import { RequestsPage } from './RequestsPage'
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
      { path: '/items/:id', element: <ItemDetailPage /> },
      { path: '/requests', element: <RequestsPage /> },
      { path: '/reservations/:id', element: <ReservationDetailPage /> },
      { path: '/earnings', element: <EarningsPage /> },
    ],
  },
])
```

- [ ] **Step 2: Run the full test suite**

Run: `pnpm --filter @rentatodo/web test -- --run`
Expected: every test file passes — all 17 tasks' tests plus every carried-over test from the original Phase 1 scaffold (`Button`, `format`, `mockData`, `AuthContext`, `RequireAuth`, `App`).

- [ ] **Step 3: Run the production build**

Run: `pnpm --filter @rentatodo/web build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/index.tsx
git commit -m "feat(web): register /items/publish route, finish dashboard visual redesign"
```

- [ ] **Step 5: Manual browser smoke test**

Run: `pnpm --filter @rentatodo/web dev`, open `http://localhost:5173/`. Confirm: sidebar renders with all 4 nav groups in Spanish; logging in (any email/password) lands on Resumen with 4 KPI cards populated; Mis artículos shows item cards with availability strips and a working Editar/Eliminar; Publicar artículo shows a live-updating preview and actually adds the item to Mis artículos on submit; Solicitudes shows colored status badges; clicking into an item's Calendario shows two navigable months with a booked (red) date range; clicking a reservation row goes to its detail page with a working report form; Ganancias lets you click between items to update the breakdown panel. Stop the dev server after confirming.

---

## Out of Scope (unchanged from the design spec)

- Any change to `apps/mobile`'s colors/theming.
- Real API integration (Phase 2).
- Full calendar business logic beyond painting the given mock `unavailable_dates` and navigating months.
- CI wiring (`.github/workflows/ci.yml`).
- Any change to `packages/contracts/openapi.yaml`.
