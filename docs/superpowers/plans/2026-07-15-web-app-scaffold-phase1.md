# Web App Scaffold — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `apps/web` (the owner dashboard) as a Vite + React + TypeScript SPA with all 8 Phase 1 page shells rendering placeholder/mock data, styled with Tailwind CSS + shadcn/ui pulling shared brand tokens from a new `packages/design-tokens` package.

**Architecture:** A pnpm workspace (`apps/web` + `packages/*`) hosts a plain Vite SPA (no SSR — everything is behind login). React Router provides client-side routing behind a stubbed `RequireAuth`/`AuthContext` pair that is not wired to any real network call yet. Every page reads from a single typed mock-data module (`src/lib/mockData.ts`) whose shapes mirror `packages/contracts/openapi.yaml` field-for-field, so swapping in real API calls in Phase 2 is a data-source swap, not a UI rewrite.

**Tech Stack:** React 18 + TypeScript, Vite, React Router, Tailwind CSS + shadcn/ui, pnpm, Vitest + React Testing Library.

## Global Constraints

- Scope: this plan touches only `apps/web` and `packages/design-tokens`. Never edit `apps/api`, `apps/mobile`, `.github/`, `e2e/`, or `infra/`.
- Phase 1 only: **no real network calls.** Every page reads from `src/lib/mockData.ts`. `AuthContext.login()`/`logout()` just flip local state — they do not call `POST /auth/login`.
- Money: integer USD centavos everywhere in mock data and types (`5000` = $50.00). Use the `formatCentavos` helper for display; never store or compare floats.
- Dates: `YYYY-MM-DD` strings (`start_date`, `end_date`); timestamps: ISO 8601 with `Z` (`created_at`, `updated_at`).
- `CategoryEnum` is exactly: `tools, photography, camping, sports, electronics, home` (per `packages/contracts/openapi.yaml`).
- `ReservationStatusEnum` is exactly: `requested, approved, delivered, returned, closed, rejected, cancelled`. `deposit_status` is exactly: `none, held, released, frozen`. `TransactionTypeEnum` is exactly: `hold, release, freeze`.
- Package manager: pnpm only (`packageManager: pnpm@9.15.0` pinned at the workspace root). Do not use npm or yarn inside `apps/web` or `packages/design-tokens`.
- Pinned versions (exact, to avoid drift): `vite@^8.1.4`, `react@^19.2.7`, `react-dom@^19.2.7`, `typescript@~6.0.2`, `react-router-dom@^6.28.0`, `tailwindcss@^3.4.14`, `vitest@^2.1.4`, `@testing-library/react@^16.0.1`, `@testing-library/jest-dom@^6.6.2`, `jsdom@^25.0.1`.
  - **Note (updated after Task 3):** the plan originally pinned `vite@^6.0.0`/`react@^18.3.1`/`typescript@^5.6.3` — current versions when the plan was written. Task 3's scaffold (`create-vite@latest`) pulled the actual current toolchain (Vite 8.1.4, React 19.2.7, TypeScript 6.0.3) instead. Per explicit user decision, the plan now targets these current versions rather than forcing a downgrade — later tasks and reviewers should treat the versions above (not the superseded ones) as the binding constraint.
- Design tokens (`packages/design-tokens/tokens.ts`) must use these exact values — copied verbatim from `apps/mobile/src/constants/brand.ts` and `theme.ts`'s `Spacing`, for visual parity with the mobile app:
  - Colors: `teal:#0E7C7B, tealSoft:#E4F1F0, ink:#1F3B57, paper:#F5F6F7, card:#FFFFFF, line:#E2E6E9, muted:#7A8791, red:#B3402E, redSoft:#F7E0DB`
  - Spacing (px): `half:2, one:4, two:8, three:16, four:24, five:32, six:64`
- Every page component gets at least one Vitest smoke test per the design doc's Testing section.

---

## Task 1: pnpm workspace root

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (repo root)
- Modify: none

**Interfaces:**
- Produces: a pnpm workspace containing `apps/web` and `packages/*`. `apps/api` (Python) and `apps/mobile` (its own npm project) are intentionally NOT listed and stay untouched.

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/web"
  - "packages/*"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "rentatodo",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 3: Verify pnpm recognizes the workspace**

Run: `pnpm -v`
Expected: prints a version (confirms pnpm is installed; if missing, install via `corepack enable && corepack prepare pnpm@9.15.0 --activate` first).

Run: `pnpm install`
Expected: completes with no packages yet (workspace has no members with a `package.json` at this point), no error about the workspace file itself.

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore: add pnpm workspace root for apps/web and packages/*"
```

---

## Task 2: `packages/design-tokens`

**Files:**
- Create: `packages/design-tokens/package.json`
- Create: `packages/design-tokens/tokens.ts`
- Create: `packages/design-tokens/README.md`
- Delete: nothing (package didn't exist)

**Interfaces:**
- Produces: `colors: { teal, tealSoft, ink, paper, card, line, muted, red, redSoft }` (hex strings) and `spacing: { half, one, two, three, four, five, six }` (unitless px numbers), importable as `@rentatodo/design-tokens`.
- Consumed by: Task 4 (Tailwind spacing scale) and Task 6 (shadcn CSS variables).

- [ ] **Step 1: Create `packages/design-tokens/tokens.ts`**

```ts
// Mirrors apps/mobile/src/constants/brand.ts and theme.ts's Spacing exactly,
// so apps/web (Tailwind) and apps/mobile (NativeWind, wired separately by
// Zero) stay visually consistent. Update both places together if they change.

export const colors = {
  teal: '#0E7C7B',
  tealSoft: '#E4F1F0',
  ink: '#1F3B57',
  paper: '#F5F6F7',
  card: '#FFFFFF',
  line: '#E2E6E9',
  muted: '#7A8791',
  red: '#B3402E',
  redSoft: '#F7E0DB',
} as const;

export const spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
```

- [ ] **Step 2: Create `packages/design-tokens/package.json`**

```json
{
  "name": "@rentatodo/design-tokens",
  "version": "0.1.0",
  "private": true,
  "main": "tokens.ts",
  "types": "tokens.ts"
}
```

- [ ] **Step 3: Create `packages/design-tokens/README.md`**

```markdown
# @rentatodo/design-tokens

Shared color and spacing values for RentaTodo's owner dashboard (`apps/web`,
Tailwind CSS) and renter app (`apps/mobile`, NativeWind). Keeping both
consumers pointed at this one file is what keeps the two apps visually
consistent.

## Usage from Tailwind (apps/web)

```ts
import { colors, spacing } from '@rentatodo/design-tokens';
```

See `apps/web/tailwind.config.ts` for how the spacing scale is consumed, and
`apps/web/src/index.css` for how the colors are turned into shadcn/ui's CSS
variables.

## Usage from NativeWind (apps/mobile) — not wired yet

`apps/mobile` currently defines its own copy of these values in
`src/constants/brand.ts` and `src/constants/theme.ts`. Wiring NativeWind's
`tailwind.config.js` to import `colors`/`spacing` from this package instead
is a follow-up owned by whoever maintains `apps/mobile` — not part of this
package's initial scope. Until then, keep the two copies in sync by hand if
either changes.
```

- [ ] **Step 4: Verify the package resolves in the workspace**

Run: `pnpm install`
Expected: no errors; `pnpm-lock.yaml` is created/updated at the repo root.

- [ ] **Step 5: Commit**

```bash
git add packages/design-tokens pnpm-lock.yaml
git commit -m "feat(design-tokens): add shared color/spacing package for apps/web"
```

---

## Task 3: Vite + React + TypeScript scaffold

**Files:**
- Delete: `apps/web/.gitkeep`
- Create: `apps/web/` (full Vite `react-ts` template output — `package.json`, `vite.config.ts`, `tsconfig.json` + `tsconfig.app.json`/`tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, etc.)
- Modify: `apps/web/package.json` (add `@rentatodo/design-tokens` workspace dependency, set package name)

**Interfaces:**
- Produces: a working `pnpm --filter web dev` dev server and `pnpm --filter web build` production build.

- [ ] **Step 1: Remove the placeholder and scaffold Vite**

```bash
rm apps/web/.gitkeep
pnpm create vite@latest apps/web -- --template react-ts
```

- [ ] **Step 2: Set the package name and add the design-tokens dependency**

Open `apps/web/package.json`, change `"name"` and add the dependency:

```json
{
  "name": "@rentatodo/web",
  "private": true,
  "dependencies": {
    "@rentatodo/design-tokens": "workspace:*"
  }
}
```

(Keep the rest of the generated `package.json` — scripts, `react`/`react-dom`, `devDependencies` — as-is; just add the `name` change and the one dependency line above under the existing `dependencies` key.)

- [ ] **Step 3: Add the `@/*` path alias**

Open whichever tsconfig file the scaffold generated with the `"include"` pointing at `src` (Vite 5/6 templates name it `tsconfig.app.json`; older templates use `tsconfig.json` directly — use whichever one exists) and add:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Open `apps/web/vite.config.ts` and add a matching alias so the bundler resolves it the same way TypeScript does:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Install and verify the dev server boots**

```bash
pnpm install
pnpm --filter @rentatodo/web dev -- --port 5173
```

Expected: Vite prints `Local: http://localhost:5173/`. Stop the server (Ctrl-C) once confirmed.

- [ ] **Step 5: Verify the production build works**

Run: `pnpm --filter @rentatodo/web build`
Expected: exits 0, prints a `dist/` build summary.

- [ ] **Step 6: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold Vite + React + TypeScript app"
```

---

## Task 4: Tailwind CSS wired to design tokens

**Files:**
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Modify: `apps/web/src/index.css` (replace default Vite CSS with Tailwind directives)
- Modify: `apps/web/src/App.tsx` (prove a token-derived class renders)
- Modify: `apps/web/package.json` (add `tailwindcss`, `postcss`, `autoprefixer` devDependencies)
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `spacing` from `@rentatodo/design-tokens` (Task 2).
- Produces: a `tailwind.config.ts` with `theme.extend.spacing` populated from the shared tokens; color tokens are wired separately in Task 6 via shadcn's CSS variables.

- [ ] **Step 1: Install Tailwind and its PostCSS dependencies**

```bash
pnpm --filter @rentatodo/web add -D tailwindcss@^3.4.14 postcss@^8.4.47 autoprefixer@^10.4.20
```

- [ ] **Step 2: Create `apps/web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'
import { spacing } from '@rentatodo/design-tokens'

const pxSpacing = Object.fromEntries(
  Object.entries(spacing).map(([key, value]) => [key, `${value}px`]),
)

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      spacing: pxSpacing,
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 3: Create `apps/web/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: Replace `apps/web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Write the failing test proving Tailwind classes apply**

```tsx
// apps/web/src/App.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders with the spacing-four token class applied', () => {
    render(<App />)
    const root = screen.getByTestId('app-root')
    expect(root).toHaveClass('p-four')
  })
})
```

(This test will not run yet — Vitest isn't configured until Task 5. Write the file now; Task 5's first step runs it.)

- [ ] **Step 6: Update `apps/web/src/App.tsx` to use a spacing token class**

```tsx
function App() {
  return (
    <div data-testid="app-root" className="p-four">
      RentaTodo dashboard
    </div>
  )
}

export default App
```

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): wire Tailwind CSS to shared spacing tokens"
```

---

## Task 5: Vitest + React Testing Library harness

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Modify: `apps/web/package.json` (add `test` script, add devDependencies)

**Interfaces:**
- Produces: `pnpm --filter @rentatodo/web test` running every `*.test.tsx` file under `src/`, with `@testing-library/jest-dom` matchers globally available.

- [ ] **Step 1: Install test dependencies**

```bash
pnpm --filter @rentatodo/web add -D vitest@^2.1.4 @testing-library/react@^16.0.1 @testing-library/jest-dom@^6.6.2 @testing-library/user-event@^14.5.2 jsdom@^25.0.1
```

- [ ] **Step 2: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 3: Create `apps/web/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Add the `test` script to `apps/web/package.json`**

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 5: Run the App smoke test from Task 4 and verify it passes**

Run: `pnpm --filter @rentatodo/web test`
Expected: `App > renders with the spacing-four token class applied` PASSES (1 test, 1 passed).

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "test(web): add Vitest + React Testing Library harness"
```

---

## Task 6: shadcn/ui baseline components with brand-mapped CSS variables

**Files:**
- Create: `apps/web/components.json` (generated by shadcn CLI)
- Create: `apps/web/src/lib/utils.ts` (generated by shadcn CLI — `cn()` helper)
- Create: `apps/web/src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `dialog.tsx`, `table.tsx`, `form.tsx` (generated by shadcn CLI)
- Modify: `apps/web/src/index.css` (replace shadcn's default CSS variables with brand-derived HSL values)
- Modify: `apps/web/package.json` (shadcn CLI adds `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/*`, `react-hook-form`, `@hookform/resolvers`, `zod`)
- Test: `apps/web/src/components/ui/button.test.tsx`

**Interfaces:**
- Consumes: `colors` from `@rentatodo/design-tokens` (used only as the source values for the hand-converted HSL variables below — shadcn's CLI itself doesn't import the package).
- Produces: `Button`, `Input`, `Label`, `Dialog`/`DialogTrigger`/`DialogContent`, `Table`/`TableRow`/`TableCell`/etc., `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` — all importable from `@/components/ui/*`, styled with brand colors.

- [ ] **Step 1: Run the shadcn init CLI**

```bash
pnpm --filter @rentatodo/web dlx shadcn@latest init -d
```

Expected: creates `apps/web/components.json`, `apps/web/src/lib/utils.ts`, adds CSS variables to `apps/web/src/index.css`, and installs `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` as dependencies.

- [ ] **Step 2: Add the baseline components**

```bash
pnpm --filter @rentatodo/web dlx shadcn@latest add button input label dialog table form -y
```

Expected: creates the six component files listed above under `apps/web/src/components/ui/`, and installs `@radix-ui/react-dialog`, `@radix-ui/react-label`, `@radix-ui/react-slot`, `react-hook-form`, `@hookform/resolvers`, `zod`.

- [ ] **Step 3: Replace the CSS variables in `apps/web/src/index.css` with brand-derived values**

The shadcn CLI wrote default zinc/slate HSL values under `:root` and `.dark`. Replace the `:root` block's variables (leave `.dark` as generated — dark mode is out of scope for Phase 1) with these, converted from the exact hex values in `packages/design-tokens/tokens.ts`:

```css
:root {
  --background: 210 11% 96%;        /* paper #F5F6F7 */
  --foreground: 210 47% 23%;        /* ink #1F3B57 */
  --card: 0 0% 100%;                /* card #FFFFFF */
  --card-foreground: 210 47% 23%;   /* ink */
  --popover: 0 0% 100%;             /* card */
  --popover-foreground: 210 47% 23%;/* ink */
  --primary: 179 80% 27%;           /* teal #0E7C7B */
  --primary-foreground: 0 0% 100%;  /* white text on teal */
  --secondary: 175 32% 92%;         /* tealSoft #E4F1F0 */
  --secondary-foreground: 210 47% 23%; /* ink */
  --muted: 206 14% 90%;             /* line #E2E6E9 */
  --muted-foreground: 206 9% 52%;   /* muted #7A8791 */
  --accent: 175 32% 92%;            /* tealSoft */
  --accent-foreground: 210 47% 23%; /* ink */
  --destructive: 8 59% 44%;         /* red #B3402E */
  --destructive-foreground: 0 0% 100%; /* white */
  --border: 206 14% 90%;            /* line */
  --input: 206 14% 90%;             /* line */
  --ring: 179 80% 27%;              /* teal */
  --radius: 0.5rem;
}
```

- [ ] **Step 4: Write the failing test for a brand-styled Button**

```tsx
// apps/web/src/components/ui/button.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('renders its children and the primary background class by default', () => {
    render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveClass('bg-primary')
  })
})
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- button.test`
Expected: PASS (shadcn's generated `Button` already applies `bg-primary` for the default variant — this test is verifying the CSS variable wiring from Step 3 produces the right class, not new component code).

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): install shadcn/ui baseline components, map CSS variables to brand tokens"
```

---

## Task 7: Mock data module and money formatter

**Files:**
- Create: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/lib/mockData.ts`
- Create: `apps/web/src/lib/format.ts`
- Test: `apps/web/src/lib/format.test.ts`
- Test: `apps/web/src/lib/mockData.test.ts`

**Interfaces:**
- Produces: every type and mock fixture later page tasks import — `User`, `Item`, `ItemDetail`, `Reservation`, `Transaction`, `Earnings`, `Category`, `ReservationStatus`, `DepositStatus`, `TransactionType`, and `mockUser`, `mockItems`, `mockItemDetail(id)`, `mockRequests`, `mockTransactions`, `mockEarnings`. Also `formatCentavos(cents: number): string`.

- [ ] **Step 1: Create `apps/web/src/lib/types.ts`**

```ts
export type Category =
  | 'tools'
  | 'photography'
  | 'camping'
  | 'sports'
  | 'electronics'
  | 'home'

export interface User {
  id: string
  name: string
  email: string
  created_at: string
}

export interface Item {
  id: string
  name: string
  description: string
  category: Category
  price_per_day: number
  photo_url: string
  is_active: boolean
  owner_id: string
  owner_name: string
  created_at: string
}

export interface UnavailableRange {
  start_date: string
  end_date: string
}

export interface ItemDetail extends Item {
  unavailable_dates: UnavailableRange[]
}

export type ReservationStatus =
  | 'requested'
  | 'approved'
  | 'delivered'
  | 'returned'
  | 'closed'
  | 'rejected'
  | 'cancelled'

export type DepositStatus = 'none' | 'held' | 'released' | 'frozen'

export interface Reservation {
  id: string
  item_id: string
  item_name: string
  item_photo_url: string
  renter_id: string
  renter_name: string
  start_date: string
  end_date: string
  status: ReservationStatus
  deposit_amount: number
  deposit_status: DepositStatus
  created_at: string
  updated_at: string
}

export type TransactionType = 'hold' | 'release' | 'freeze'

export interface Transaction {
  id: string
  reservation_id: string
  type: TransactionType
  amount: number
  created_at: string
}

export interface EarningsRental {
  start_date: string
  end_date: string
  amount: number
}

export interface EarningsByItem {
  item_id: string
  item_name: string
  total: number
  rentals: EarningsRental[]
}

export interface Earnings {
  total_earnings: number
  by_item: EarningsByItem[]
}
```

- [ ] **Step 2: Write the failing test for `formatCentavos`**

```ts
// apps/web/src/lib/format.test.ts
import { describe, expect, it } from 'vitest'
import { formatCentavos } from './format'

describe('formatCentavos', () => {
  it('formats whole dollars without cents drift', () => {
    expect(formatCentavos(5000)).toBe('$50.00')
  })

  it('formats amounts with cents', () => {
    expect(formatCentavos(1099)).toBe('$10.99')
  })

  it('formats zero', () => {
    expect(formatCentavos(0)).toBe('$0.00')
  })
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- format.test`
Expected: FAIL — `Cannot find module './format'` (file doesn't exist yet).

- [ ] **Step 4: Create `apps/web/src/lib/format.ts`**

```ts
export function formatCentavos(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- format.test`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing test for mock data shape**

```ts
// apps/web/src/lib/mockData.test.ts
import { describe, expect, it } from 'vitest'
import { mockEarnings, mockItemDetail, mockItems, mockRequests, mockTransactions, mockUser } from './mockData'

const CATEGORIES = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home']
const RESERVATION_STATUSES = ['requested', 'approved', 'delivered', 'returned', 'closed', 'rejected', 'cancelled']

describe('mockData', () => {
  it('mockUser has a valid shape', () => {
    expect(mockUser.email).toContain('@')
  })

  it('mockItems includes at least one inactive item', () => {
    expect(mockItems.some((item) => !item.is_active)).toBe(true)
  })

  it('every mock item has an allowed category and an integer price', () => {
    for (const item of mockItems) {
      expect(CATEGORIES).toContain(item.category)
      expect(Number.isInteger(item.price_per_day)).toBe(true)
    }
  })

  it('mockItemDetail returns unavailable_dates for a known item id', () => {
    const detail = mockItemDetail(mockItems[0].id)
    expect(detail?.unavailable_dates.length).toBeGreaterThan(0)
  })

  it('every mock request has an allowed reservation status', () => {
    for (const reservation of mockRequests) {
      expect(RESERVATION_STATUSES).toContain(reservation.status)
    }
  })

  it('mockTransactions and mockEarnings amounts are integers (centavos)', () => {
    for (const tx of mockTransactions) {
      expect(Number.isInteger(tx.amount)).toBe(true)
    }
    expect(Number.isInteger(mockEarnings.total_earnings)).toBe(true)
  })
})
```

- [ ] **Step 7: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- mockData.test`
Expected: FAIL — `Cannot find module './mockData'`.

- [ ] **Step 8: Create `apps/web/src/lib/mockData.ts`**

```ts
import type {
  Earnings,
  Item,
  ItemDetail,
  Reservation,
  Transaction,
  User,
} from './types'

export const mockUser: User = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'María Vargas',
  email: 'maria@example.com',
  created_at: '2026-06-01T10:00:00Z',
}

export const mockItems: Item[] = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Taladro Bosch Professional',
    description: 'Taladro inalámbrico 18V con maletín y 3 brocas',
    category: 'tools',
    price_per_day: 1000,
    photo_url: 'https://storage.example.com/photos/taladro.jpg',
    is_active: true,
    owner_id: mockUser.id,
    owner_name: mockUser.name,
    created_at: '2026-06-05T09:00:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Carpa Camping 4 personas',
    description: 'Carpa impermeable, fácil armado, incluye estacas',
    category: 'camping',
    price_per_day: 1500,
    photo_url: 'https://storage.example.com/photos/carpa.jpg',
    is_active: true,
    owner_id: mockUser.id,
    owner_name: mockUser.name,
    created_at: '2026-06-10T09:00:00Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Cámara Canon EOS antigua',
    description: 'Cámara réflex, dada de baja de la lista pública',
    category: 'photography',
    price_per_day: 2000,
    photo_url: 'https://storage.example.com/photos/canon.jpg',
    is_active: false,
    owner_id: mockUser.id,
    owner_name: mockUser.name,
    created_at: '2026-05-20T09:00:00Z',
  },
]

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

export const mockRequests: Reservation[] = [
  {
    id: '55555555-5555-4555-8555-555555555555',
    item_id: mockItems[0].id,
    item_name: mockItems[0].name,
    item_photo_url: mockItems[0].photo_url,
    renter_id: '66666666-6666-4666-8666-666666666666',
    renter_name: 'Jorge Salas',
    start_date: '2026-07-18',
    end_date: '2026-07-20',
    status: 'requested',
    deposit_amount: 2000,
    deposit_status: 'none',
    created_at: '2026-07-14T12:00:00Z',
    updated_at: '2026-07-14T12:00:00Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    item_id: mockItems[1].id,
    item_name: mockItems[1].name,
    item_photo_url: mockItems[1].photo_url,
    renter_id: '88888888-8888-4888-8888-888888888888',
    renter_name: 'Camila Ríos',
    start_date: '2026-07-10',
    end_date: '2026-07-12',
    status: 'delivered',
    deposit_amount: 4500,
    deposit_status: 'held',
    created_at: '2026-07-08T09:00:00Z',
    updated_at: '2026-07-10T08:00:00Z',
  },
]

export const mockTransactions: Transaction[] = [
  {
    id: '99999999-9999-4999-8999-999999999999',
    reservation_id: mockRequests[1].id,
    type: 'hold',
    amount: 4500,
    created_at: '2026-07-10T08:00:00Z',
  },
]

export const mockEarnings: Earnings = {
  total_earnings: 7000,
  by_item: [
    {
      item_id: mockItems[0].id,
      item_name: mockItems[0].name,
      total: 3000,
      rentals: [{ start_date: '2026-06-01', end_date: '2026-06-03', amount: 3000 }],
    },
    {
      item_id: mockItems[1].id,
      item_name: mockItems[1].name,
      total: 4000,
      rentals: [{ start_date: '2026-06-10', end_date: '2026-06-12', amount: 4000 }],
    },
  ],
}
```

- [ ] **Step 9: Run both test files and verify they pass**

Run: `pnpm --filter @rentatodo/web test -- lib`
Expected: PASS — 9 tests across `format.test.ts` and `mockData.test.ts`.

- [ ] **Step 10: Commit**

```bash
git add apps/web
git commit -m "feat(web): add typed mock data mirroring the OpenAPI contract"
```

---

## Task 8: AuthContext + RequireAuth

**Files:**
- Create: `apps/web/src/lib/AuthContext.tsx`
- Create: `apps/web/src/components/RequireAuth.tsx`
- Test: `apps/web/src/lib/AuthContext.test.tsx`
- Test: `apps/web/src/components/RequireAuth.test.tsx`

**Interfaces:**
- Produces: `AuthProvider` (context provider), `useAuth(): { isAuthenticated: boolean; login: () => void; logout: () => void }`, and `RequireAuth({ children }: { children: JSX.Element })` which renders `children` if authenticated or `<Navigate to="/login" replace />` otherwise.
- Consumes: `react-router-dom`'s `Navigate` (already installed via Task 3's `react-router-dom` — see Step 0 below, it's added here since this is the first task that needs it).

- [ ] **Step 0: Install react-router-dom**

```bash
pnpm --filter @rentatodo/web add react-router-dom@^6.28.0
```

- [ ] **Step 1: Write the failing test for AuthContext**

```tsx
// apps/web/src/lib/AuthContext.test.tsx
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const { isAuthenticated, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <button onClick={login}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  it('starts unauthenticated, then flips on login()/logout()', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status')).toHaveTextContent('out')

    act(() => screen.getByText('login').click())
    expect(screen.getByTestId('status')).toHaveTextContent('in')

    act(() => screen.getByText('logout').click())
    expect(screen.getByTestId('status')).toHaveTextContent('out')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- AuthContext.test`
Expected: FAIL — `Cannot find module './AuthContext'`.

- [ ] **Step 3: Create `apps/web/src/lib/AuthContext.tsx`**

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react'

interface AuthContextValue {
  isAuthenticated: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const value: AuthContextValue = {
    isAuthenticated,
    login: () => setIsAuthenticated(true),
    logout: () => setIsAuthenticated(false),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- AuthContext.test`
Expected: PASS.

- [ ] **Step 5: Write the failing test for RequireAuth**

```tsx
// apps/web/src/components/RequireAuth.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { RequireAuth } from './RequireAuth'

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <div>Protected dashboard</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RequireAuth', () => {
  it('redirects to /login when not authenticated', () => {
    renderAt('/dashboard')
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- RequireAuth.test`
Expected: FAIL — `Cannot find module './RequireAuth'`.

- [ ] **Step 7: Create `apps/web/src/components/RequireAuth.tsx`**

```tsx
import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export function RequireAuth({ children }: { children: ReactElement }): ReactElement {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}
```

- [ ] **Step 8: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- RequireAuth.test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat(web): add placeholder AuthContext and RequireAuth route guard"
```

---

## Task 9: DashboardLayout with navigation

**Files:**
- Create: `apps/web/src/layouts/DashboardLayout.tsx`
- Test: `apps/web/src/layouts/DashboardLayout.test.tsx`

**Interfaces:**
- Produces: `DashboardLayout` — renders a nav with links to `/dashboard`, `/items`, `/requests`, `/earnings`, plus a logout button (calls `useAuth().logout`), and an `<Outlet />` for the active route's page.
- Consumes: `useAuth` from Task 8.

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

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'My items' })).toHaveAttribute('href', '/items')
    expect(screen.getByRole('link', { name: 'Requests' })).toHaveAttribute('href', '/requests')
    expect(screen.getByRole('link', { name: 'Earnings' })).toHaveAttribute('href', '/earnings')
    expect(screen.getByText('Home content')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- DashboardLayout.test`
Expected: FAIL — `Cannot find module './DashboardLayout'`.

- [ ] **Step 3: Create `apps/web/src/layouts/DashboardLayout.tsx`**

```tsx
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/items', label: 'My items' },
  { to: '/requests', label: 'Requests' },
  { to: '/earnings', label: 'Earnings' },
]

export function DashboardLayout() {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-four py-three">
        <nav className="flex gap-four">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="text-foreground hover:text-primary">
              {link.label}
            </Link>
          ))}
        </nav>
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </header>
      <main className="p-four">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- DashboardLayout.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): add DashboardLayout with top-level navigation"
```

---

## Task 10: `/login` page

**Files:**
- Create: `apps/web/src/routes/LoginPage.tsx`
- Test: `apps/web/src/routes/LoginPage.test.tsx`

**Interfaces:**
- Produces: `LoginPage` — email/password form; on submit, calls `useAuth().login()` (no network call — Phase 1 placeholder per the design doc).
- Consumes: `useAuth` (Task 8), `Button`/`Input`/`Label` (Task 6).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/LoginPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { LoginPage } from './LoginPage'

function StatusProbe() {
  const { isAuthenticated } = useAuth()
  return <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
}

describe('LoginPage', () => {
  it('renders email/password fields and authenticates on submit', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
          <StatusProbe />
        </MemoryRouter>
      </AuthProvider>,
    )

    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(screen.getByTestId('status')).toHaveTextContent('in')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- LoginPage.test`
Expected: FAIL — `Cannot find module './LoginPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Phase 1: no real POST /auth/login call yet — just flips local auth state.
    login()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-three rounded-lg border border-border bg-card p-four">
        <h1 className="text-lg font-semibold text-foreground">Log in</h1>
        <div className="space-y-half">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">
          Log in
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- LoginPage.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): add /login page shell"
```

---

## Task 11: `/register` page

**Files:**
- Create: `apps/web/src/routes/RegisterPage.tsx`
- Test: `apps/web/src/routes/RegisterPage.test.tsx`

**Interfaces:**
- Produces: `RegisterPage` — name/email/password form; on submit, navigates to `/login` (no network call — matches `POST /auth/register` returning a `UserResponse`, not a token, so the real flow would also send the user to log in next).

- [ ] **Step 1: Write the failing test**

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
Expected: FAIL — `Cannot find module './RegisterPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/RegisterPage.tsx`**

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
        <h1 className="text-lg font-semibold text-foreground">Create account</h1>
        <div className="space-y-half">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">
          Create account
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
git add apps/web
git commit -m "feat(web): add /register page shell"
```

---

## Task 12: `/dashboard` page

**Files:**
- Create: `apps/web/src/routes/DashboardPage.tsx`
- Test: `apps/web/src/routes/DashboardPage.test.tsx`

**Interfaces:**
- Produces: `DashboardPage` — shows the owner's profile summary from `mockUser`.
- Consumes: `mockUser` (Task 7).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/DashboardPage.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockUser } from '@/lib/mockData'
import { DashboardPage } from './DashboardPage'

describe('DashboardPage', () => {
  it("renders the owner's name and email", () => {
    render(<DashboardPage />)
    expect(screen.getByText(mockUser.name)).toBeInTheDocument()
    expect(screen.getByText(mockUser.email)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- DashboardPage.test`
Expected: FAIL — `Cannot find module './DashboardPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/DashboardPage.tsx`**

```tsx
import { mockUser } from '@/lib/mockData'

export function DashboardPage() {
  return (
    <div className="space-y-two">
      <h1 className="text-lg font-semibold text-foreground">Welcome back</h1>
      <p className="text-foreground">{mockUser.name}</p>
      <p className="text-muted-foreground">{mockUser.email}</p>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- DashboardPage.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): add /dashboard page shell"
```

---

## Task 13: `/items` page

**Files:**
- Create: `apps/web/src/routes/ItemsPage.tsx`
- Test: `apps/web/src/routes/ItemsPage.test.tsx`

**Interfaces:**
- Produces: `ItemsPage` — lists all mock items (including inactive, with an "Inactive" badge), a "Publish item" button that opens a `Dialog` with a create-item form, plus per-row "Edit" (reopens the same dialog pre-filled) and "Delete" (confirm, then soft-delete by flipping `is_active` to `false` — matches the contract's `DELETE /items/{id}` semantics, never removes the row) actions. All local state only, no network call.
- Consumes: `mockItems`, `Item`, `Category` (Task 7), `formatCentavos` (Task 7), `Button`/`Dialog`/`Input`/`Label` (Task 6).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/ItemsPage.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemsPage } from './ItemsPage'

describe('ItemsPage', () => {
  it('lists every mock item, marking inactive ones', () => {
    render(<ItemsPage />)
    for (const item of mockItems) {
      expect(screen.getByText(item.name)).toBeInTheDocument()
    }
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('opens the publish dialog and adds a new item to the list', async () => {
    const user = userEvent.setup()
    render(<ItemsPage />)

    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    await user.type(screen.getByLabelText('Name'), 'Bicicleta de montaña')
    await user.type(screen.getByLabelText('Description'), 'Rodado 29, frenos de disco')
    await user.type(screen.getByLabelText('Price per day (USD)'), '12')
    await user.type(screen.getByLabelText('Photo URL'), 'https://storage.example.com/photos/bici.jpg')
    await user.click(screen.getByRole('button', { name: 'Save item' }))

    expect(screen.getByText('Bicicleta de montaña')).toBeInTheDocument()
  })

  it('edits an existing item through the pre-filled dialog', async () => {
    const user = userEvent.setup()
    render(<ItemsPage />)
    const target = mockItems[0]

    const row = screen.getByText(target.name).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Edit' }))

    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Taladro Bosch Professional (renovado)')
    await user.click(screen.getByRole('button', { name: 'Save item' }))

    expect(screen.getByText('Taladro Bosch Professional (renovado)')).toBeInTheDocument()
  })

  it('soft-deletes an item after confirming, without removing it from the list', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ItemsPage />)
    const target = mockItems.find((item) => item.is_active)!

    const row = screen.getByText(target.name).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Delete' }))

    expect(screen.getByText(target.name)).toBeInTheDocument()
    expect(within(screen.getByText(target.name).closest('li')!).getByText('Inactive')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- ItemsPage.test`
Expected: FAIL — `Cannot find module './ItemsPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/ItemsPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { mockItems } from '@/lib/mockData'
import type { Category, Item } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES: Category[] = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home']

const BLANK_FORM = { name: '', description: '', category: CATEGORIES[0], priceDollars: '', photoUrl: '' }

export function ItemsPage() {
  const [items, setItems] = useState<Item[]>(mockItems)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_FORM)

  function openCreateDialog() {
    setEditingId(null)
    setForm(BLANK_FORM)
    setOpen(true)
  }

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
            ? { ...item, name: form.name, description: form.description, category: form.category, price_per_day: priceCentavos, photo_url: form.photoUrl }
            : item,
        ),
      )
    } else {
      const newItem: Item = {
        id: crypto.randomUUID(),
        name: form.name,
        description: form.description,
        category: form.category,
        price_per_day: priceCentavos,
        photo_url: form.photoUrl,
        is_active: true,
        owner_id: 'local-owner',
        owner_name: 'You',
        created_at: new Date().toISOString(),
      }
      setItems((current) => [...current, newItem])
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

  return (
    <div className="space-y-three">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">My items</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>Publish item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit item' : 'Publish item'}</DialogTitle>
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
                      {c}
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
      </div>

      <ul className="space-y-two">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-three">
            <div>
              <Link to={`/items/${item.id}`} className="font-medium text-foreground hover:text-primary">
                {item.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {item.category} · {formatCentavos(item.price_per_day)}/day
              </p>
            </div>
            <div className="flex items-center gap-two">
              {!item.is_active && (
                <span className="rounded-full bg-destructive px-two py-half text-xs text-destructive-foreground">Inactive</span>
              )}
              <Button size="sm" variant="outline" onClick={() => openEditDialog(item)}>
                Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(item)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- ItemsPage.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): add /items page shell with publish/edit/delete actions"
```

---

## Task 14: `/items/:id` page

**Files:**
- Create: `apps/web/src/routes/ItemDetailPage.tsx`
- Test: `apps/web/src/routes/ItemDetailPage.test.tsx`

**Interfaces:**
- Produces: `ItemDetailPage` — reads `:id` via `useParams`, renders item detail plus a list of `unavailable_dates` ranges (painted as disabled-looking chips — no interactive calendar widget needed for Phase 1, per the design doc: "the frontend only paints/disables those ranges, no client-side overlap math").
- Consumes: `mockItemDetail` (Task 7), `formatCentavos` (Task 7).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/ItemDetailPage.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemDetailPage } from './ItemDetailPage'

describe('ItemDetailPage', () => {
  it('renders the item name and its unavailable date ranges', () => {
    const item = mockItems[0]
    render(
      <MemoryRouter initialEntries={[`/items/${item.id}`]}>
        <Routes>
          <Route path="/items/:id" element={<ItemDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(item.name)).toBeInTheDocument()
    expect(screen.getByText('2026-07-18 → 2026-07-20')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- ItemDetailPage.test`
Expected: FAIL — `Cannot find module './ItemDetailPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/ItemDetailPage.tsx`**

```tsx
import { useParams } from 'react-router-dom'
import { mockItemDetail } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const item = id ? mockItemDetail(id) : undefined

  if (!item) {
    return <p className="text-muted-foreground">Item not found.</p>
  }

  return (
    <div className="space-y-three">
      <h1 className="text-lg font-semibold text-foreground">{item.name}</h1>
      <p className="text-foreground">{item.description}</p>
      <p className="text-muted-foreground">
        {item.category} · {formatCentavos(item.price_per_day)}/day
      </p>

      <div>
        <h2 className="font-medium text-foreground">Unavailable dates</h2>
        <ul className="space-y-half">
          {item.unavailable_dates.map((range) => (
            <li
              key={`${range.start_date}-${range.end_date}`}
              className="w-fit rounded-md bg-destructive px-two py-half text-sm text-destructive-foreground"
            >
              {range.start_date} → {range.end_date}
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
git add apps/web
git commit -m "feat(web): add /items/:id detail page shell"
```

---

## Task 15: `/requests` page

**Files:**
- Create: `apps/web/src/routes/RequestsPage.tsx`
- Test: `apps/web/src/routes/RequestsPage.test.tsx`

**Interfaces:**
- Produces: `RequestsPage` — table of incoming reservation requests (renter name + dates inline, per the contract), with "Approve"/"Reject" buttons that update local state (`requested` → `approved`/`rejected`) — no network call.
- Consumes: `mockRequests`, `Reservation` (Task 7), `Table`/`Button` (Task 6).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/RequestsPage.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockRequests } from '@/lib/mockData'
import { RequestsPage } from './RequestsPage'

describe('RequestsPage', () => {
  it('lists renter name and dates for each request', () => {
    render(<RequestsPage />)
    for (const reservation of mockRequests) {
      expect(screen.getByText(reservation.renter_name)).toBeInTheDocument()
    }
  })

  it('approving a requested reservation updates its status to approved', async () => {
    const user = userEvent.setup()
    render(<RequestsPage />)

    const requested = mockRequests.find((r) => r.status === 'requested')!
    const row = screen.getByText(requested.renter_name).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Approve' }))

    expect(within(row).getByText('approved')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- RequestsPage.test`
Expected: FAIL — `Cannot find module './RequestsPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/RequestsPage.tsx`**

```tsx
import { useState } from 'react'
import { mockRequests } from '@/lib/mockData'
import type { Reservation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function RequestsPage() {
  const [requests, setRequests] = useState<Reservation[]>(mockRequests)

  function setStatus(id: string, status: Reservation['status']) {
    setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  return (
    <div className="space-y-three">
      <h1 className="text-lg font-semibold text-foreground">Requests received</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Renter</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((reservation) => (
            <TableRow key={reservation.id}>
              <TableCell>{reservation.renter_name}</TableCell>
              <TableCell>
                {reservation.start_date} → {reservation.end_date}
              </TableCell>
              <TableCell>{reservation.status}</TableCell>
              <TableCell className="space-x-two">
                {reservation.status === 'requested' && (
                  <>
                    <Button size="sm" onClick={() => setStatus(reservation.id, 'approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setStatus(reservation.id, 'rejected')}>
                      Reject
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

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- RequestsPage.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): add /requests page shell with approve/reject actions"
```

---

## Task 16: `/reservations/:id` page

**Files:**
- Create: `apps/web/src/routes/ReservationDetailPage.tsx`
- Test: `apps/web/src/routes/ReservationDetailPage.test.tsx`

**Interfaces:**
- Produces: `ReservationDetailPage` — close-reservation button, deposit transaction history table, and a report-problem form (reason + photo_url, per `CreateReportRequest`) available to both owner and renter — matches the resolved product decision in the design doc.
- Consumes: `mockRequests` (to find the reservation by id), `mockTransactions` (Task 7).

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
  it('renders the transaction history and a report-problem form', async () => {
    const user = userEvent.setup()
    const reservation = mockRequests[1]
    render(
      <MemoryRouter initialEntries={[`/reservations/${reservation.id}`]}>
        <Routes>
          <Route path="/reservations/:id" element={<ReservationDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(mockTransactions[0].type)).toBeInTheDocument()

    await user.type(screen.getByLabelText('What went wrong?'), 'The drill bit was broken')
    await user.type(screen.getByLabelText('Photo URL'), 'https://storage.example.com/photos/broken.jpg')
    await user.click(screen.getByRole('button', { name: 'Submit report' }))

    expect(screen.getByText('Report submitted.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- ReservationDetailPage.test`
Expected: FAIL — `Cannot find module './ReservationDetailPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/ReservationDetailPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { mockRequests, mockTransactions } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const reservation = mockRequests.find((r) => r.id === id)
  const transactions = mockTransactions.filter((tx) => tx.reservation_id === id)
  const [reason, setReason] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)

  if (!reservation) {
    return <p className="text-muted-foreground">Reservation not found.</p>
  }

  function handleClose() {
    // Phase 1: no real PATCH /reservations/{id}/close call yet.
    window.alert('Reservation closed (placeholder — no API call yet).')
  }

  function handleReportSubmit(event: FormEvent) {
    event.preventDefault()
    // Phase 1: no real POST /reservations/{id}/report call yet.
    setReportSubmitted(true)
  }

  return (
    <div className="space-y-four">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{reservation.item_name}</h1>
        <p className="text-muted-foreground">
          {reservation.start_date} → {reservation.end_date} · {reservation.status}
        </p>
        <Button className="mt-two" onClick={handleClose} disabled={reservation.status !== 'returned'}>
          Close reservation
        </Button>
      </div>

      <div>
        <h2 className="font-medium text-foreground">Deposit history</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{tx.type}</TableCell>
                <TableCell>{formatCentavos(tx.amount)}</TableCell>
                <TableCell>{tx.created_at}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="font-medium text-foreground">Report a problem</h2>
        {reportSubmitted ? (
          <p className="text-foreground">Report submitted.</p>
        ) : (
          <form onSubmit={handleReportSubmit} className="space-y-two">
            <div className="space-y-half">
              <Label htmlFor="report-reason">What went wrong?</Label>
              <Input id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
            <div className="space-y-half">
              <Label htmlFor="report-photo">Photo URL</Label>
              <Input id="report-photo" type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} required />
            </div>
            <Button type="submit">Submit report</Button>
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
git add apps/web
git commit -m "feat(web): add /reservations/:id page shell with close and report-problem actions"
```

---

## Task 17: `/earnings` page

**Files:**
- Create: `apps/web/src/routes/EarningsPage.tsx`
- Test: `apps/web/src/routes/EarningsPage.test.tsx`

**Interfaces:**
- Produces: `EarningsPage` — total earnings, per-item rows expandable to show the rental date-range breakdown. No renter identity anywhere on this page (matches the contract's privacy-by-design note).
- Consumes: `mockEarnings`, `formatCentavos` (Task 7).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/EarningsPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { EarningsPage } from './EarningsPage'

describe('EarningsPage', () => {
  it('shows the total and expands an item to reveal its rental breakdown', async () => {
    const user = userEvent.setup()
    render(<EarningsPage />)

    expect(screen.getByText(formatCentavos(mockEarnings.total_earnings))).toBeInTheDocument()

    const firstItem = mockEarnings.by_item[0]
    await user.click(screen.getByRole('button', { name: firstItem.item_name }))

    const firstRental = firstItem.rentals[0]
    expect(
      screen.getByText(`${firstRental.start_date} - ${firstRental.end_date}: ${formatCentavos(firstRental.amount)}`),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @rentatodo/web test -- EarningsPage.test`
Expected: FAIL — `Cannot find module './EarningsPage'`.

- [ ] **Step 3: Create `apps/web/src/routes/EarningsPage.tsx`**

```tsx
import { useState } from 'react'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { Button } from '@/components/ui/button'

export function EarningsPage() {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  return (
    <div className="space-y-three">
      <h1 className="text-lg font-semibold text-foreground">Earnings</h1>
      <p className="text-2xl font-semibold text-foreground">{formatCentavos(mockEarnings.total_earnings)}</p>

      <ul className="space-y-two">
        {mockEarnings.by_item.map((byItem) => (
          <li key={byItem.item_id} className="rounded-lg border border-border bg-card p-three">
            <Button
              variant="ghost"
              className="w-full justify-between"
              onClick={() => setExpandedItemId((current) => (current === byItem.item_id ? null : byItem.item_id))}
            >
              <span>{byItem.item_name}</span>
              <span>{formatCentavos(byItem.total)}</span>
            </Button>
            {expandedItemId === byItem.item_id && (
              <ul className="mt-two space-y-half pl-three text-sm text-muted-foreground">
                {byItem.rentals.map((rental) => (
                  <li key={`${rental.start_date}-${rental.end_date}`}>
                    {rental.start_date} - {rental.end_date}: {formatCentavos(rental.amount)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @rentatodo/web test -- EarningsPage.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): add /earnings page shell with expandable per-item breakdown"
```

---

## Task 18: Router wiring and final integration

**Files:**
- Create: `apps/web/src/routes/index.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx` (replace Task 4's placeholder test with the real integration test)

**Interfaces:**
- Produces: the fully wired `<App />` — `AuthProvider` at the root, `createBrowserRouter` with `/login`, `/register` public, and `/dashboard`, `/items`, `/items/:id`, `/requests`, `/reservations/:id`, `/earnings` behind `RequireAuth` + `DashboardLayout`, with `/` redirecting to `/dashboard`.
- Consumes: every page from Tasks 10–17, `RequireAuth` (Task 8), `DashboardLayout` (Task 9), `AuthProvider` (Task 8).

- [ ] **Step 1: Create `apps/web/src/routes/index.tsx`**

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '@/components/RequireAuth'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'
import { DashboardPage } from './DashboardPage'
import { ItemsPage } from './ItemsPage'
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
      { path: '/items/:id', element: <ItemDetailPage /> },
      { path: '/requests', element: <RequestsPage /> },
      { path: '/reservations/:id', element: <ReservationDetailPage /> },
      { path: '/earnings', element: <EarningsPage /> },
    ],
  },
])
```

(`RequireAuth` expects a single `ReactElement` child — wrapping `<DashboardLayout />` directly, rather than each individual page, means one auth check guards every nested route via `DashboardLayout`'s `<Outlet />`.)

- [ ] **Step 2: Replace `apps/web/src/App.tsx`**

```tsx
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { router } from '@/routes'

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 3: Replace `apps/web/src/App.test.tsx` with the real integration test**

```tsx
// apps/web/src/App.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('redirects an unauthenticated visitor from / to the login page', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run the full test suite**

Run: `pnpm --filter @rentatodo/web test`
Expected: PASS — every test file from Tasks 4–18 (App, Button, format, mockData, AuthContext, RequireAuth, DashboardLayout, and all 8 page tests) passes, no failures.

- [ ] **Step 5: Run the production build one final time**

Run: `pnpm --filter @rentatodo/web build`
Expected: exits 0.

- [ ] **Step 6: Manually smoke-test in the browser**

```bash
pnpm --filter @rentatodo/web dev
```

Open `http://localhost:5173/` and confirm: redirected to `/login` → log in with any values → lands on `/dashboard` with nav visible → clicking each nav link renders its page → `/items/<id>` for one of the mock item ids renders detail + unavailable dates → logout returns to `/login`. Stop the server after confirming.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): wire router, finish Phase 1 apps/web scaffold"
```

---

## Out of scope (unchanged from the design doc)

- Wiring `apps/web` into `.github/workflows/ci.yml`'s `ci-gate` (left for Wa; the CI file already has a comment marking where the `web` job goes).
- Any change to `apps/mobile` or `apps/api`.
- Phase 2: `openapi-typescript` codegen, real TanStack Query hooks, real `POST /auth/login`/`/auth/register` calls. Note: as of this plan, only Auth is implemented server-side (`apps/api`'s Items/Reservations/etc. are spec-only) — Phase 2 for those resources is blocked on backend work landing, not just on this plan.
- Deployment/hosting configuration.
