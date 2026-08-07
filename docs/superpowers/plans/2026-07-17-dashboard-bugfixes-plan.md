# Dashboard Content Pages — Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 8 confirmed bugs from the `/code-review medium` pass on PR #25 (logged in `docs/superpowers/plans/2026-07-17-dashboard-content-pages-review-followups.md`), and — for the two bugs that stem from the app having no shared data layer — introduce a minimal shared-state layer so every page reads/writes the same in-memory data instead of its own local copy.

**Architecture:** Two new React Contexts (`ItemsContext`, `RequestsContext`) each seed their state from the existing `mockData.ts` arrays and expose the same read/write shape a real API-backed store would (a list + mutation functions). Every page currently doing `useState(mockItems)` / `useState(mockRequests)` switches to consuming these contexts instead. This is deliberately the same shape the eventual real API integration will need — swapping the provider's internals from `useState(mockItems)` to a `useEffect` fetch + `POST`/`PATCH` calls will not require touching any consuming page again. The 6 bugs unrelated to shared state (KPI mismatch, arrow direction, NaN/Infinity guards, empty-array chart math, `getInitials` edge case, invalid calendar item param) are independent, mechanical fixes with no architectural dependency.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library, react-router-dom v6. No new dependencies.

## Global Constraints

- Conventional Commits (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`) — one commit per task.
- TDD: update/write the test first, watch it fail for the right reason, then make it pass.
- Match existing code style exactly: no semicolons are already absent throughout, single quotes, no comments except where the WHY is non-obvious (this codebase currently has almost none — don't add any).
- All existing tests must keep passing after each task (`cd apps/web && npx vitest run`).
- Don't touch `apps/api` or `apps/mobile` — this plan is `apps/web` only.

---

## File Structure

New files:
- `apps/web/src/lib/ItemsContext.tsx` — shared items store (state + `addItem`/`updateItem`/`setItemActive`)
- `apps/web/src/lib/ItemsContext.test.tsx` — its unit tests
- `apps/web/src/lib/RequestsContext.tsx` — shared reservations store (state + `setStatus`)
- `apps/web/src/lib/RequestsContext.test.tsx` — its unit tests

Modified files (one task touches each unless noted):
- `apps/web/src/lib/format.ts` / `format.test.ts` (Task 1)
- `apps/web/src/layouts/DashboardLayout.tsx` / `.test.tsx` (Tasks 2 and 9)
- `apps/web/src/routes/EarningsPage.tsx` / `.test.tsx` (Tasks 3 and 9)
- `apps/web/src/App.tsx` (Tasks 4 and 7)
- `apps/web/src/routes/PublishItemPage.tsx` / `.test.tsx` (Task 5)
- `apps/web/src/routes/ItemsPage.tsx` / `.test.tsx` (Task 5)
- `apps/web/src/routes/CalendarPage.tsx` / `.test.tsx` (Tasks 6 and 9)
- `apps/web/src/lib/availability.ts` / `availability.test.ts` (Task 7)
- `apps/web/src/routes/RequestsPage.tsx` / `.test.tsx` (Task 8)
- `apps/web/src/routes/DashboardPage.tsx` / `.test.tsx` (Task 8)
- `apps/web/src/lib/i18n/en.ts` (Task 6)

---

### Task 1: Fix `getInitials` mishandling double/leading/trailing spaces

**Bug:** #7 — `"María  Vargas"` (double space) produces `'M'` instead of `'MV'` because `split(' ')` yields an empty-string element whose `[0]` is `undefined`.

**Files:**
- Modify: `apps/web/src/lib/format.ts:5-12`
- Test: `apps/web/src/lib/format.test.ts` (create — none exists yet)

**Interfaces:**
- Produces: `getInitials(name: string): string` (signature unchanged, only the implementation is fixed)

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/format.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { getInitials } from './format'

describe('getInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(getInitials('María Vargas')).toBe('MV')
  })

  it('handles a double space between words', () => {
    expect(getInitials('María  Vargas')).toBe('MV')
  })

  it('handles a leading space', () => {
    expect(getInitials(' María Vargas')).toBe('MV')
  })

  it('handles a single word', () => {
    expect(getInitials('María')).toBe('M')
  })
})
```

- [ ] **Step 2: Run it to verify the double-space case fails**

Run: `cd apps/web && npx vitest run src/lib/format.test.ts`
Expected: FAIL on `'handles a double space between words'` — receives `'M'`, expected `'MV'`.

- [ ] **Step 3: Fix the implementation**

Replace `apps/web/src/lib/format.ts` in full:

```typescript
export function formatCentavos(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/format.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/format.ts apps/web/src/lib/format.test.ts
git commit -m "fix(web): handle double/leading spaces in getInitials"
```

---

### Task 2: Fix earnings trend widget — sign-based arrow + crash/NaN guard

**Bugs:** #4 (arrow always points up regardless of `deltaPct`'s sign) and #5 (`deltaPct` crashes if `by_month` has fewer than 2 entries, or is `Infinity`/`NaN` if the previous month's total is 0).

**Files:**
- Modify: `apps/web/src/layouts/DashboardLayout.tsx:14-17,84-89`
- Test: `apps/web/src/layouts/DashboardLayout.test.tsx` (add cases)

**Interfaces:**
- Consumes: `mockEarnings.by_month: EarningsByMonth[]` (unchanged, from `apps/web/src/lib/types.ts`)
- Produces: no new exports — this is a local rendering fix inside `DashboardLayout`

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/layouts/DashboardLayout.test.tsx` (inside the existing `describe('DashboardLayout', ...)` block, after the last `it`):

```typescript
  it('shows a down arrow when this month earned less than last month', async () => {
    vi.resetModules()
    vi.doMock('@/lib/mockData', async () => {
      const actual = await vi.importActual<typeof import('@/lib/mockData')>('@/lib/mockData')
      return {
        ...actual,
        mockEarnings: { ...actual.mockEarnings, by_month: [{ month: 'Jun', total: 2000 }, { month: 'Jul', total: 1000 }] },
      }
    })
    const { DashboardLayout: PatchedLayout } = await import('./DashboardLayout')
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<PatchedLayout />}>
              <Route path="/dashboard" element={<div>Home content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(screen.getByText(/↓ 50%/)).toBeInTheDocument()
    vi.doUnmock('@/lib/mockData')
  })
```

This uses module mocking because `mockEarnings` is a plain imported constant, not a prop — the widget always reads the module-level array. Add `vi` to the existing `vitest` import at the top of the file:

```typescript
import { describe, expect, it, vi } from 'vitest'
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/layouts/DashboardLayout.test.tsx`
Expected: FAIL — the arrow is hardcoded `↑`, so `/↓ 50%/` is never found.

- [ ] **Step 3: Fix the implementation**

In `apps/web/src/layouts/DashboardLayout.tsx`, replace lines 14-17:

```typescript
  const months = mockEarnings.by_month
  const currentMonth = months[months.length - 1]
  const previousMonth = months[months.length - 2]
  const deltaPct = Math.round(((currentMonth.total - previousMonth.total) / previousMonth.total) * 100)
```

with:

```typescript
  const months = mockEarnings.by_month
  const currentMonth = months[months.length - 1]
  const previousMonth = months.length >= 2 ? months[months.length - 2] : undefined
  const deltaPct =
    previousMonth && previousMonth.total !== 0
      ? Math.round(((currentMonth.total - previousMonth.total) / previousMonth.total) * 100)
      : undefined
```

Then replace lines 84-89 (the earned-this-month card block):

```typescript
        <div className="mt-four rounded-lg bg-sidebar-card p-three">
          <p className="text-xs font-medium uppercase tracking-wide text-sidebar-foreground/60">{t.nav.earnedThisMonth}</p>
          <p className="mt-half font-display text-xl font-semibold text-white">{formatCentavos(currentMonth.total)}</p>
          <p className="mt-half text-xs text-on-dark-accent">
            ↑ {deltaPct}% {t.nav.vsLastMonth}
          </p>
        </div>
```

with:

```typescript
        <div className="mt-four rounded-lg bg-sidebar-card p-three">
          <p className="text-xs font-medium uppercase tracking-wide text-sidebar-foreground/60">{t.nav.earnedThisMonth}</p>
          <p className="mt-half font-display text-xl font-semibold text-white">{formatCentavos(currentMonth.total)}</p>
          {deltaPct !== undefined && (
            <p className="mt-half text-xs text-on-dark-accent">
              {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct)}% {t.nav.vsLastMonth}
            </p>
          )}
        </div>
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/layouts/DashboardLayout.test.tsx`
Expected: PASS, all cases including the new one (existing mock data still shows `↑ 42%` since Jul 1700 > Jun 1200).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/layouts/DashboardLayout.tsx apps/web/src/layouts/DashboardLayout.test.tsx
git commit -m "fix(web): sign-aware earnings arrow, guard deltaPct crash/NaN"
```

---

### Task 3: Guard empty-array chart maths in EarningsPage

**Bug:** #6 — `Math.max(...[])` is `-Infinity`, which would corrupt bar-height and progress-bar-width CSS if `by_month`/`by_item` were ever empty. Not reachable today (static non-empty mock arrays) but must be defensive since real data can be empty for a new user.

**Files:**
- Modify: `apps/web/src/routes/EarningsPage.tsx:13-14`
- Test: `apps/web/src/routes/EarningsPage.test.tsx` (add a case)

**Interfaces:**
- No exported interface changes — internal calculation fix only.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/routes/EarningsPage.test.tsx`:

```typescript
  it('does not render NaN/Infinity bar heights when earnings data is empty', () => {
    vi.resetModules()
    vi.doMock('@/lib/mockData', async () => {
      const actual = await vi.importActual<typeof import('@/lib/mockData')>('@/lib/mockData')
      return { ...actual, mockEarnings: { total_earnings: 0, by_item: [], by_month: [] } }
    })
    expect(async () => {
      const { EarningsPage: PatchedPage } = await import('./EarningsPage')
      render(<PatchedPage />)
    }).not.toThrow()
    vi.doUnmock('@/lib/mockData')
  })
```

Add `vi` to the existing `vitest` import: `import { describe, expect, it, vi } from 'vitest'`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/routes/EarningsPage.test.tsx`
Expected: FAIL — `currentMonth` is `undefined` when `by_month` is empty, so `currentMonth.total` throws a `TypeError` inside the render, which the test's `not.toThrow()` catches as a failure (the throw happens inside React's render, so it will actually surface as an uncaught render error — either way the test fails, confirming the crash).

- [ ] **Step 3: Fix the implementation**

In `apps/web/src/routes/EarningsPage.tsx`, replace lines 9-14:

```typescript
  const [selectedItemId, setSelectedItemId] = useState(mockEarnings.by_item[0]?.item_id)
  const selected = mockEarnings.by_item.find((i) => i.item_id === selectedItemId)
  const closedCount = mockRequests.filter((r) => r.status === 'closed').length
  const currentMonth = mockEarnings.by_month[mockEarnings.by_month.length - 1]
  const maxMonth = Math.max(...mockEarnings.by_month.map((m) => m.total))
  const maxItem = Math.max(...mockEarnings.by_item.map((i) => i.total))
```

with:

```typescript
  const [selectedItemId, setSelectedItemId] = useState(mockEarnings.by_item[0]?.item_id)
  const selected = mockEarnings.by_item.find((i) => i.item_id === selectedItemId)
  const closedCount = mockRequests.filter((r) => r.status === 'closed').length
  const currentMonth = mockEarnings.by_month[mockEarnings.by_month.length - 1] ?? { month: '', total: 0 }
  const maxMonth = Math.max(1, ...mockEarnings.by_month.map((m) => m.total))
  const maxItem = Math.max(1, ...mockEarnings.by_item.map((i) => i.total))
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/routes/EarningsPage.test.tsx`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/EarningsPage.tsx apps/web/src/routes/EarningsPage.test.tsx
git commit -m "fix(web): guard EarningsPage chart maths against empty data"
```

---

### Task 4: Create `ItemsContext` and wire it into the app

**Bug this enables fixing:** #1 (publishing an item never persists it).

**Files:**
- Create: `apps/web/src/lib/ItemsContext.tsx`
- Create: `apps/web/src/lib/ItemsContext.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Produces: `ItemsProvider({ children }: { children: ReactNode })`, `useItems(): { items: Item[]; addItem: (item: Omit<Item, 'id' | 'created_at' | 'is_active'>) => void; updateItem: (id: string, updates: Partial<Omit<Item, 'id'>>) => void; setItemActive: (id: string, isActive: boolean) => void }`
- Consumed by: Tasks 5 and 6 (`PublishItemPage`, `ItemsPage`, `CalendarPage`)

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/ItemsContext.test.tsx`:

```typescript
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockItems } from './mockData'
import { ItemsProvider, useItems } from './ItemsContext'

function Probe() {
  const { items, addItem, updateItem, setItemActive } = useItems()
  return (
    <div>
      <span data-testid="count">{items.length}</span>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.name} · {item.is_active ? 'active' : 'inactive'}
          </li>
        ))}
      </ul>
      <button
        onClick={() =>
          addItem({
            name: 'New Item',
            description: 'desc',
            category: 'tools',
            price_per_day: 500,
            photo_url: 'https://example.com/p.jpg',
            owner_id: mockItems[0].owner_id,
            owner_name: mockItems[0].owner_name,
          })
        }
      >
        add
      </button>
      <button onClick={() => updateItem(mockItems[0].id, { name: 'Renamed' })}>update</button>
      <button onClick={() => setItemActive(mockItems[0].id, false)}>deactivate</button>
    </div>
  )
}

describe('ItemsContext', () => {
  it('starts seeded with mockItems', () => {
    render(
      <ItemsProvider>
        <Probe />
      </ItemsProvider>,
    )
    expect(screen.getByTestId('count')).toHaveTextContent(String(mockItems.length))
  })

  it('addItem appends a new active item with a generated id', () => {
    render(
      <ItemsProvider>
        <Probe />
      </ItemsProvider>,
    )
    act(() => screen.getByText('add').click())
    expect(screen.getByTestId('count')).toHaveTextContent(String(mockItems.length + 1))
    expect(screen.getByText('New Item · active')).toBeInTheDocument()
  })

  it('updateItem patches an existing item by id', () => {
    render(
      <ItemsProvider>
        <Probe />
      </ItemsProvider>,
    )
    act(() => screen.getByText('update').click())
    expect(screen.getByText(new RegExp('Renamed'))).toBeInTheDocument()
  })

  it('setItemActive flips is_active without removing the item', () => {
    render(
      <ItemsProvider>
        <Probe />
      </ItemsProvider>,
    )
    act(() => screen.getByText('deactivate').click())
    expect(screen.getByTestId('count')).toHaveTextContent(String(mockItems.length))
    expect(screen.getByText(`${mockItems[0].name} · inactive`)).toBeInTheDocument()
  })

  it('throws when useItems is called outside a provider', () => {
    function Bare() {
      useItems()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useItems must be used within an ItemsProvider')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/ItemsContext.test.tsx`
Expected: FAIL with "Cannot find module './ItemsContext'".

- [ ] **Step 3: Create the implementation**

Create `apps/web/src/lib/ItemsContext.tsx`:

```typescript
import { createContext, useContext, useState, type ReactNode } from 'react'
import { mockItems } from './mockData'
import type { Item } from './types'

interface ItemsContextValue {
  items: Item[]
  addItem: (item: Omit<Item, 'id' | 'created_at' | 'is_active'>) => void
  updateItem: (id: string, updates: Partial<Omit<Item, 'id'>>) => void
  setItemActive: (id: string, isActive: boolean) => void
}

const ItemsContext = createContext<ItemsContextValue | undefined>(undefined)

export function ItemsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>(mockItems)

  function addItem(item: Omit<Item, 'id' | 'created_at' | 'is_active'>) {
    const newItem: Item = {
      ...item,
      id: crypto.randomUUID(),
      is_active: true,
      created_at: new Date().toISOString(),
    }
    setItems((current) => [newItem, ...current])
  }

  function updateItem(id: string, updates: Partial<Omit<Item, 'id'>>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }

  function setItemActive(id: string, isActive: boolean) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, is_active: isActive } : item)))
  }

  const value: ItemsContextValue = { items, addItem, updateItem, setItemActive }
  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>
}

export function useItems(): ItemsContextValue {
  const context = useContext(ItemsContext)
  if (!context) {
    throw new Error('useItems must be used within an ItemsProvider')
  }
  return context
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/ItemsContext.test.tsx`
Expected: PASS, 5/5.

- [ ] **Step 5: Wire the provider into `App.tsx`**

Replace `apps/web/src/App.tsx` in full:

```typescript
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { router } from '@/routes'

function App() {
  return (
    <AuthProvider>
      <ItemsProvider>
        <RouterProvider router={router} />
      </ItemsProvider>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 6: Run the full suite to confirm nothing else broke**

Run: `cd apps/web && npx vitest run`
Expected: PASS (no page consumes `ItemsContext` yet, so nothing else changes behavior).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/ItemsContext.tsx apps/web/src/lib/ItemsContext.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): add ItemsContext, a shared in-memory items store"
```

---

### Task 5: Migrate `PublishItemPage` and `ItemsPage` to `ItemsContext`

**Bug:** #1 — publishing an item only navigated to `/items`; nothing was ever added anywhere, so the new item never appeared in the list.

**Files:**
- Modify: `apps/web/src/routes/PublishItemPage.tsx:1-46`
- Modify: `apps/web/src/routes/PublishItemPage.test.tsx`
- Modify: `apps/web/src/routes/ItemsPage.tsx:1-80`
- Modify: `apps/web/src/routes/ItemsPage.test.tsx`

**Interfaces:**
- Consumes: `useItems()` from Task 4 (`items`, `addItem`, `updateItem`, `setItemActive`)

- [ ] **Step 1: Update `PublishItemPage.test.tsx` to wrap the new provider and assert real persistence**

Replace `apps/web/src/routes/PublishItemPage.test.tsx` in full:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ItemsProvider } from '@/lib/ItemsContext'
import { PublishItemPage } from './PublishItemPage'
import { ItemsPage } from './ItemsPage'

function renderPage() {
  render(
    <ItemsProvider>
      <MemoryRouter initialEntries={['/items/publish']}>
        <Routes>
          <Route path="/items/publish" element={<PublishItemPage />} />
          <Route path="/items" element={<ItemsPage />} />
        </Routes>
      </MemoryRouter>
    </ItemsProvider>,
  )
}

describe('PublishItemPage', () => {
  it('reflects the typed name in the live preview', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Taladro Bosch Professional')
    expect(screen.getAllByText('Taladro Bosch Professional')).toHaveLength(1)
  })

  it('adds the new item to the Items list on submit', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Bicicleta de montaña')
    await user.type(screen.getByLabelText('Price per day (USD)'), '10')
    await user.type(screen.getByLabelText('Description'), 'A description')
    await user.type(screen.getByLabelText('Photo'), 'https://example.com/photo.jpg')
    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    expect(screen.getByRole('heading', { name: 'My items' })).toBeInTheDocument()
    expect(screen.getByText('Bicicleta de montaña')).toBeInTheDocument()
  })

  it('navigates to /items on cancel without submitting', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'My items' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Update `ItemsPage.test.tsx` to wrap the provider**

In `apps/web/src/routes/ItemsPage.test.tsx`, replace the import block and every `render(...)` call. Replace lines 1-6:

```typescript
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemsProvider } from '@/lib/ItemsContext'
import { ItemsPage } from './ItemsPage'

function renderPage() {
  render(
    <ItemsProvider>
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>
    </ItemsProvider>,
  )
}
```

Then replace every occurrence of:

```typescript
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
```

with:

```typescript
    renderPage()
```

(there are 4 occurrences — one per `it` block).

- [ ] **Step 3: Run both test files to verify they fail for the right reason**

Run: `cd apps/web && npx vitest run src/routes/PublishItemPage.test.tsx src/routes/ItemsPage.test.tsx`
Expected: FAIL — `useItems must be used within an ItemsProvider` (neither page consumes the context yet), and the new "adds the new item" test fails because the item never appears.

- [ ] **Step 4: Migrate `PublishItemPage`**

In `apps/web/src/routes/PublishItemPage.tsx`, add the import (after the `PageHeader` import):

```typescript
import { useItems } from '@/lib/ItemsContext'
```

Add the hook call inside the component, right after `const navigate = useNavigate()`:

```typescript
  const { addItem } = useItems()
```

Replace `handleSubmit` (lines 36-41):

```typescript
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Phase 1: no real POST /items call yet — mirrors the rest of the app's
    // mock-data-only behavior, just navigates back.
    navigate('/items')
  }
```

with:

```typescript
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    addItem({
      name,
      description,
      category,
      price_per_day: Math.round(Number(priceDollars || '0') * 100),
      photo_url: photoUrl,
      owner_id: mockUser.id,
      owner_name: mockUser.name,
    })
    navigate('/items')
  }
```

- [ ] **Step 5: Migrate `ItemsPage`**

In `apps/web/src/routes/ItemsPage.tsx`, replace the import block (lines 1-11):

```typescript
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
```

with:

```typescript
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { ItemCard } from '@/components/ItemCard'
import { useItems } from '@/lib/ItemsContext'
import type { Category, Item } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
```

Replace the state/derived-values block (lines 17-32):

```typescript
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
```

with:

```typescript
export function ItemsPage() {
  const t = useTranslation()
  const { items, updateItem, setItemActive } = useItems()
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
```

Replace `handleSubmit`, `handleDelete`, `handleReactivate` (lines 46-80):

```typescript
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
```

with:

```typescript
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const priceCentavos = Math.round(Number(form.priceDollars) * 100)
    if (editingId) {
      updateItem(editingId, {
        name: form.name,
        description: form.description,
        category: form.category,
        price_per_day: priceCentavos,
        photo_url: form.photoUrl,
      })
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
    setItemActive(item.id, false)
  }

  function handleReactivate(item: Item) {
    setItemActive(item.id, true)
  }
```

- [ ] **Step 6: Run both test files to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/PublishItemPage.test.tsx src/routes/ItemsPage.test.tsx`
Expected: PASS, all cases including "adds the new item to the Items list on submit".

- [ ] **Step 7: Run the full suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/routes/PublishItemPage.tsx apps/web/src/routes/PublishItemPage.test.tsx apps/web/src/routes/ItemsPage.tsx apps/web/src/routes/ItemsPage.test.tsx
git commit -m "fix(web): persist published items via shared ItemsContext"
```

---

### Task 6: Migrate `CalendarPage`'s item picker to `ItemsContext` + guard invalid `?item=`

**Bug:** #8 — an invalid `?item=` query param silently falls back to the first item with no indication anything was wrong.

**Files:**
- Modify: `apps/web/src/routes/CalendarPage.tsx`
- Modify: `apps/web/src/routes/CalendarPage.test.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts:40-54`

**Interfaces:**
- Consumes: `useItems()` from Task 4 (`items` only, read-only here)

- [ ] **Step 1: Add the `itemNotFound` string to the dictionary**

In `apps/web/src/lib/i18n/en.ts`, inside the `calendar` object, add a new key after `subtitle`:

```typescript
  calendar: {
    title: 'Calendar',
    subtitle: 'Availability by date, item by item.',
    itemNotFound: "This item doesn't exist or is no longer yours.",
    weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
```

- [ ] **Step 2: Update `CalendarPage.test.tsx` — wrap `ItemsProvider` and add the not-found case**

Replace `apps/web/src/routes/CalendarPage.test.tsx` in full:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems, mockRequests } from '@/lib/mockData'
import { ItemsProvider } from '@/lib/ItemsContext'
import { CalendarPage } from './CalendarPage'

function renderPage(initialEntry = '/requests/calendar') {
  render(
    <ItemsProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/requests/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    </ItemsProvider>,
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

  it('shows a not-found message instead of silently falling back for an invalid ?item=', () => {
    renderPage('/requests/calendar?item=does-not-exist')
    expect(screen.getByText("This item doesn't exist or is no longer yours.")).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run it to verify the new case fails**

Run: `cd apps/web && npx vitest run src/routes/CalendarPage.test.tsx`
Expected: FAIL on the new "shows a not-found message" case — today it silently renders `mockItems[0]`'s calendar instead.

- [ ] **Step 4: Fix the implementation**

Replace `apps/web/src/routes/CalendarPage.tsx` in full:

```typescript
import { useMemo, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { CalendarMonth } from '@/components/CalendarMonth'
import { StatusBadge } from '@/components/StatusBadge'
import { getItemDateStates } from '@/lib/availability'
import { useItems } from '@/lib/ItemsContext'
import { mockRequests } from '@/lib/mockData'
import { useTranslation } from '@/lib/i18n'

export function CalendarPage() {
  const t = useTranslation()
  const { items } = useItems()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedId = searchParams.get('item')
  const selectedItem = requestedId ? items.find((i) => i.id === requestedId) : items[0]

  const dateRanges = useMemo(
    () => (selectedItem ? getItemDateStates(selectedItem.id, mockRequests) : []),
    [selectedItem],
  )
  const itemReservations = useMemo(
    () => (selectedItem ? mockRequests.filter((r) => r.item_id === selectedItem.id) : []),
    [selectedItem],
  )

  const now = new Date()
  const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const secondMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  function handleSelect(event: ChangeEvent<HTMLSelectElement>) {
    setSearchParams({ item: event.target.value })
  }

  if (requestedId && !selectedItem) {
    return (
      <div>
        <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />
        <div className="p-four text-sm text-muted-foreground">{t.calendar.itemNotFound}</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t.calendar.title}
        subtitle={t.calendar.subtitle}
        action={
          <select
            value={selectedItem!.id}
            onChange={handleSelect}
            aria-label={t.calendar.title}
            className="rounded-md border border-input bg-card px-two py-half text-foreground"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        }
      />
      <div className="space-y-four p-four">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-foreground">{selectedItem!.name}</h2>
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

(`items` is never empty in practice — `mockItems` is seed data and items are only ever soft-deleted — so `items[0]` is safe when `requestedId` is absent; the `selectedItem!` non-null assertions below the early-return are safe because that return already handles the one case where `selectedItem` can be falsy.)

- [ ] **Step 5: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/routes/CalendarPage.test.tsx`
Expected: PASS, all 5 cases.

- [ ] **Step 6: Run the full suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/CalendarPage.tsx apps/web/src/routes/CalendarPage.test.tsx apps/web/src/lib/i18n/en.ts
git commit -m "fix(web): show not-found state for invalid calendar ?item= param"
```

---

### Task 7: Create `RequestsContext`, export `RESERVED_STATUSES`, wire into the app

**Bug this enables fixing:** #2 (Dashboard/Requests hold independent reservation state) and sets up #3's fix.

**Files:**
- Create: `apps/web/src/lib/RequestsContext.tsx`
- Create: `apps/web/src/lib/RequestsContext.test.tsx`
- Modify: `apps/web/src/lib/availability.ts:1-4`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Produces: `RequestsProvider({ children }: { children: ReactNode })`, `useRequests(): { requests: Reservation[]; setStatus: (id: string, status: Reservation['status']) => void }`
- Produces: `RESERVED_STATUSES: ReservationStatus[]` exported from `apps/web/src/lib/availability.ts` (was module-private)
- Consumed by: Task 8 (`RequestsPage`, `DashboardPage`) and Task 9 (`DashboardLayout`, `EarningsPage`, `CalendarPage`)

- [ ] **Step 1: Export `RESERVED_STATUSES` (small, standalone change first)**

In `apps/web/src/lib/availability.ts`, replace lines 1-4:

```typescript
import { getDateState, toDateOnlyString } from './calendar'
import type { DateRangeState, Reservation } from './types'

const RESERVED_STATUSES = ['approved', 'delivered', 'returned']
```

with:

```typescript
import { getDateState, toDateOnlyString } from './calendar'
import type { DateRangeState, Reservation, ReservationStatus } from './types'

export const RESERVED_STATUSES: ReservationStatus[] = ['approved', 'delivered', 'returned']
```

Run: `cd apps/web && npx vitest run src/lib/availability.test.ts` (if it doesn't exist, run `cd apps/web && npx vitest run` instead)
Expected: PASS — this is a pure export addition, no behavior change.

- [ ] **Step 2: Write the failing test for `RequestsContext`**

Create `apps/web/src/lib/RequestsContext.test.tsx`:

```typescript
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockRequests } from './mockData'
import { RequestsProvider, useRequests } from './RequestsContext'

function Probe() {
  const { requests, setStatus } = useRequests()
  const first = requests[0]
  return (
    <div>
      <span data-testid="count">{requests.length}</span>
      <span data-testid="first-status">{first.status}</span>
      <button onClick={() => setStatus(first.id, 'approved')}>approve</button>
    </div>
  )
}

describe('RequestsContext', () => {
  it('starts seeded with mockRequests', () => {
    render(
      <RequestsProvider>
        <Probe />
      </RequestsProvider>,
    )
    expect(screen.getByTestId('count')).toHaveTextContent(String(mockRequests.length))
  })

  it('setStatus updates the matching reservation by id', () => {
    render(
      <RequestsProvider>
        <Probe />
      </RequestsProvider>,
    )
    act(() => screen.getByText('approve').click())
    expect(screen.getByTestId('first-status')).toHaveTextContent('approved')
  })

  it('throws when useRequests is called outside a provider', () => {
    function Bare() {
      useRequests()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useRequests must be used within a RequestsProvider')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/RequestsContext.test.tsx`
Expected: FAIL with "Cannot find module './RequestsContext'".

- [ ] **Step 4: Create the implementation**

Create `apps/web/src/lib/RequestsContext.tsx`:

```typescript
import { createContext, useContext, useState, type ReactNode } from 'react'
import { mockRequests } from './mockData'
import type { Reservation } from './types'

interface RequestsContextValue {
  requests: Reservation[]
  setStatus: (id: string, status: Reservation['status']) => void
}

const RequestsContext = createContext<RequestsContextValue | undefined>(undefined)

export function RequestsProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<Reservation[]>(mockRequests)

  function setStatus(id: string, status: Reservation['status']) {
    setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  const value: RequestsContextValue = { requests, setStatus }
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>
}

export function useRequests(): RequestsContextValue {
  const context = useContext(RequestsContext)
  if (!context) {
    throw new Error('useRequests must be used within a RequestsProvider')
  }
  return context
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/RequestsContext.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 6: Wire the provider into `App.tsx`**

Replace `apps/web/src/App.tsx` in full:

```typescript
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { router } from '@/routes'

function App() {
  return (
    <AuthProvider>
      <ItemsProvider>
        <RequestsProvider>
          <RouterProvider router={router} />
        </RequestsProvider>
      </ItemsProvider>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 7: Run the full suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS (no page consumes `RequestsContext` yet).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/RequestsContext.tsx apps/web/src/lib/RequestsContext.test.tsx apps/web/src/lib/availability.ts apps/web/src/App.tsx
git commit -m "feat(web): add RequestsContext, a shared in-memory reservations store"
```

---

### Task 8: Migrate `RequestsPage` + `DashboardPage` to `RequestsContext`, fix the KPI mismatch

**Bugs:** #2 (core case — approving on Dashboard doesn't reflect on Requests, or vice versa) and #3 (Dashboard's "Active reservations" KPI hardcodes `['approved', 'delivered']`, excluding `'returned'`, disagreeing with `RequestsPage`'s Active tab).

**Files:**
- Modify: `apps/web/src/routes/RequestsPage.tsx`
- Modify: `apps/web/src/routes/RequestsPage.test.tsx`
- Modify: `apps/web/src/routes/DashboardPage.tsx`
- Modify: `apps/web/src/routes/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `useRequests()` and `RESERVED_STATUSES` from Task 7

- [ ] **Step 1: Update `RequestsPage.test.tsx` to wrap `RequestsProvider`**

In `apps/web/src/routes/RequestsPage.test.tsx`, replace lines 1-17:

```typescript
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockRequests } from '@/lib/mockData'
import { RequestsProvider } from '@/lib/RequestsContext'
import { RequestsPage } from './RequestsPage'

function renderPage() {
  render(
    <RequestsProvider>
      <MemoryRouter initialEntries={['/requests']}>
        <Routes>
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/reservations/:id" element={<div>Reservation detail</div>} />
        </Routes>
      </MemoryRouter>
    </RequestsProvider>,
  )
}
```

- [ ] **Step 2: Update `DashboardPage.test.tsx` to wrap `RequestsProvider`, add a cross-page regression test**

Replace `apps/web/src/routes/DashboardPage.test.tsx` in full:

```typescript
// apps/web/src/routes/DashboardPage.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems, mockRequests } from '@/lib/mockData'
import { RequestsProvider } from '@/lib/RequestsContext'
import { RESERVED_STATUSES } from '@/lib/availability'
import { DashboardPage } from './DashboardPage'
import { RequestsPage } from './RequestsPage'

function renderDashboard() {
  render(
    <RequestsProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </RequestsProvider>,
  )
}

describe('DashboardPage', () => {
  it('renders KPI cards derived from mock data', () => {
    renderDashboard()
    const activeItems = mockItems.filter((i) => i.is_active).length
    const pending = mockRequests.filter((r) => r.status === 'requested').length

    const activeItemsCard = screen.getByText('Active items').closest('div')!
    expect(within(activeItemsCard).getByText(String(activeItems))).toBeInTheDocument()

    const pendingCard = screen.getByText('Pending requests').closest('div')!
    expect(within(pendingCard).getByText(String(pending))).toBeInTheDocument()
  })

  it('renders the "Earned this month" KPI card with the dark-inverted treatment', () => {
    renderDashboard()
    const earnedCard = screen.getByText('Earned this month').closest('div')!
    expect(earnedCard).toHaveClass('bg-sidebar')
    expect(within(earnedCard).getByText((content) => content.startsWith('$'))).toHaveClass('text-on-dark-accent')
  })

  it('shows at most 2 pending requests and lets you approve one', async () => {
    const user = userEvent.setup()
    renderDashboard()
    const firstPending = mockRequests.filter((r) => r.status === 'requested')[0]
    const row = screen.getByText(new RegExp(firstPending.renter_name)).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Approve' }))
    expect(screen.queryByText(new RegExp(firstPending.renter_name))).not.toBeInTheDocument()
  })

  it('renders the page header with the title and welcome message', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText('Welcome back, María')).toBeInTheDocument()
  })

  it('"Active reservations" KPI matches RequestsPage\'s Active tab count, including returned', () => {
    renderDashboard()
    const expectedActive = mockRequests.filter((r) => RESERVED_STATUSES.includes(r.status)).length
    const activeCard = screen.getByText('Active reservations').closest('div')!
    expect(within(activeCard).getByText(String(expectedActive))).toBeInTheDocument()
  })

  it('approving a request on the Dashboard is reflected on the Requests page', async () => {
    const user = userEvent.setup()
    render(
      <RequestsProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/requests" element={<RequestsPage />} />
          </Routes>
        </MemoryRouter>
      </RequestsProvider>,
    )
    const firstPending = mockRequests.filter((r) => r.status === 'requested')[0]
    const row = screen.getByText(new RegExp(firstPending.renter_name)).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Approve' }))
    expect(screen.queryByText(new RegExp(firstPending.renter_name))).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run both test files to verify they fail for the right reason**

Run: `cd apps/web && npx vitest run src/routes/RequestsPage.test.tsx src/routes/DashboardPage.test.tsx`
Expected: FAIL — `useRequests must be used within a RequestsProvider` (neither page consumes the context yet), plus the new KPI-parity and cross-page tests fail.

- [ ] **Step 4: Migrate `RequestsPage`**

Replace `apps/web/src/routes/RequestsPage.tsx` lines 1-28:

```typescript
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
```

with:

```typescript
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReservationStatus } from '@/lib/types'
import { formatCentavos, getInitials } from '@/lib/format'
import { useTranslation } from '@/lib/i18n'
import { useRequests } from '@/lib/RequestsContext'
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
  const { requests, setStatus } = useRequests()
  const [tab, setTab] = useState<Tab>('pending')
  const [query, setQuery] = useState('')
```

- [ ] **Step 5: Migrate `DashboardPage`, fixing the KPI mismatch in the same pass**

Replace `apps/web/src/routes/DashboardPage.tsx` lines 1-20:

```typescript
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mockEarnings, mockItems, mockRequests, mockUser } from '@/lib/mockData'
import type { Reservation } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

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
```

with:

```typescript
import { Link } from 'react-router-dom'
import { mockEarnings, mockItems, mockUser } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { useTranslation } from '@/lib/i18n'
import { useRequests } from '@/lib/RequestsContext'
import { RESERVED_STATUSES } from '@/lib/availability'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export function DashboardPage() {
  const t = useTranslation()
  const { requests, setStatus } = useRequests()
  const activeItems = mockItems.filter((item) => item.is_active).length
  const pendingRequests = requests.filter((r) => r.status === 'requested')
  const activeReservations = requests.filter((r) => RESERVED_STATUSES.includes(r.status)).length
  const recentPending = pendingRequests.slice(0, 2)
```

- [ ] **Step 6: Run both test files to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/RequestsPage.test.tsx src/routes/DashboardPage.test.tsx`
Expected: PASS, all cases including the new KPI-parity and cross-page tests.

- [ ] **Step 7: Run the full suite**

Run: `cd apps/web && npx vitest run`
Expected: FAIL — `DashboardLayout.test.tsx` and `EarningsPage.test.tsx`/`CalendarPage.test.tsx` still read `mockRequests` directly and aren't wrapped in `RequestsProvider` yet; that's fine, they're Task 9's job. Confirm the only failures are in those files, nothing in `RequestsPage`/`DashboardPage`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/routes/RequestsPage.tsx apps/web/src/routes/RequestsPage.test.tsx apps/web/src/routes/DashboardPage.tsx apps/web/src/routes/DashboardPage.test.tsx
git commit -m "fix(web): share reservation state between Dashboard and Requests, fix KPI mismatch"
```

---

### Task 9: Migrate remaining reservation consumers to `RequestsContext`

**Why:** Once Dashboard and Requests share state (Task 8), `DashboardLayout`'s pending-count badge, `EarningsPage`'s closed-count KPI, and `CalendarPage`'s reservation list would be the *only* parts of the app still frozen on the static `mockRequests` import — reintroducing the exact same class of staleness bug in three more places. This completes bug #2's fix everywhere it applies.

**Files:**
- Modify: `apps/web/src/layouts/DashboardLayout.tsx`
- Modify: `apps/web/src/layouts/DashboardLayout.test.tsx`
- Modify: `apps/web/src/routes/EarningsPage.tsx`
- Modify: `apps/web/src/routes/EarningsPage.test.tsx`
- Modify: `apps/web/src/routes/CalendarPage.tsx`
- Modify: `apps/web/src/routes/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: `useRequests()` from Task 7

- [ ] **Step 1: Update `DashboardLayout.test.tsx` to wrap `RequestsProvider`**

In `apps/web/src/layouts/DashboardLayout.test.tsx`, replace lines 1-21:

```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { DashboardLayout } from './DashboardLayout'

function renderLayout() {
  render(
    <AuthProvider>
      <RequestsProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<div>Home content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RequestsProvider>
    </AuthProvider>,
  )
}
```

(This also folds in the `vi` import Task 2 already added — keep both `vi`-based tests from Task 2 working by also wrapping their local render calls in `<RequestsProvider>`. In each `vi.doMock`-based test from Task 2, change the render call's `<AuthProvider>` block to include `<RequestsProvider>` the same way `renderLayout` does above.)

- [ ] **Step 2: Update `EarningsPage.test.tsx` to wrap `RequestsProvider`**

In `apps/web/src/routes/EarningsPage.test.tsx`, add the import and wrap every `render(<EarningsPage />)` call. Replace lines 1-7:

```typescript
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { RequestsProvider } from '@/lib/RequestsContext'
import { EarningsPage } from './EarningsPage'

function renderPage() {
  render(
    <RequestsProvider>
      <EarningsPage />
    </RequestsProvider>,
  )
}
```

Replace every `render(<EarningsPage />)` call (there are 3 in the pre-existing tests) with `renderPage()`. For the Task 3 empty-data test, wrap similarly:

```typescript
    expect(async () => {
      const { EarningsPage: PatchedPage } = await import('./EarningsPage')
      render(
        <RequestsProvider>
          <PatchedPage />
        </RequestsProvider>,
      )
    }).not.toThrow()
```

- [ ] **Step 3: Update `CalendarPage.test.tsx` to wrap `RequestsProvider`**

In `apps/web/src/routes/CalendarPage.test.tsx`, wrap the existing `<ItemsProvider>` with `<RequestsProvider>` in `renderPage`:

```typescript
function renderPage(initialEntry = '/requests/calendar') {
  render(
    <RequestsProvider>
      <ItemsProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/requests/calendar" element={<CalendarPage />} />
          </Routes>
        </MemoryRouter>
      </ItemsProvider>
    </RequestsProvider>,
  )
}
```

Add the import: `import { RequestsProvider } from '@/lib/RequestsContext'`.

- [ ] **Step 4: Run the three test files to verify they fail for the right reason**

Run: `cd apps/web && npx vitest run src/layouts/DashboardLayout.test.tsx src/routes/EarningsPage.test.tsx src/routes/CalendarPage.test.tsx`
Expected: FAIL — none of the three pages consume `RequestsContext` yet, so they still import `mockRequests` directly (this doesn't throw like the other contexts since they never call a hook, so instead check: this step's real purpose is confirming the *providers* render without error before the pages are migrated — if it unexpectedly passes already, skip straight to Step 5, the migration is still needed for correctness even if these particular assertions don't currently fail).

- [ ] **Step 5: Migrate `DashboardLayout`**

In `apps/web/src/layouts/DashboardLayout.tsx`, replace line 6:

```typescript
import { mockEarnings, mockRequests, mockUser } from '@/lib/mockData'
```

with:

```typescript
import { mockEarnings, mockUser } from '@/lib/mockData'
import { useRequests } from '@/lib/RequestsContext'
```

Replace line 13:

```typescript
  const pendingCount = mockRequests.filter((r) => r.status === 'requested').length
```

with:

```typescript
  const { requests } = useRequests()
  const pendingCount = requests.filter((r) => r.status === 'requested').length
```

- [ ] **Step 6: Migrate `EarningsPage`**

In `apps/web/src/routes/EarningsPage.tsx`, replace line 2:

```typescript
import { mockEarnings, mockRequests } from '@/lib/mockData'
```

with:

```typescript
import { mockEarnings } from '@/lib/mockData'
import { useRequests } from '@/lib/RequestsContext'
```

Replace line 11:

```typescript
  const closedCount = mockRequests.filter((r) => r.status === 'closed').length
```

with:

```typescript
  const { requests } = useRequests()
  const closedCount = requests.filter((r) => r.status === 'closed').length
```

- [ ] **Step 7: Migrate `CalendarPage`**

In `apps/web/src/routes/CalendarPage.tsx`, replace:

```typescript
import { mockRequests } from '@/lib/mockData'
```

with:

```typescript
import { useRequests } from '@/lib/RequestsContext'
```

Add the hook call inside the component, right after `const { items } = useItems()`:

```typescript
  const { requests } = useRequests()
```

Replace every remaining reference to `mockRequests` in this file with `requests` (two occurrences: inside the `dateRanges` and `itemReservations` `useMemo` calls).

- [ ] **Step 8: Run the three test files to verify they pass**

Run: `cd apps/web && npx vitest run src/layouts/DashboardLayout.test.tsx src/routes/EarningsPage.test.tsx src/routes/CalendarPage.test.tsx`
Expected: PASS, all cases.

- [ ] **Step 9: Run the full suite one final time**

Run: `cd apps/web && npx vitest run`
Expected: PASS, every test file.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/layouts/DashboardLayout.tsx apps/web/src/layouts/DashboardLayout.test.tsx apps/web/src/routes/EarningsPage.tsx apps/web/src/routes/EarningsPage.test.tsx apps/web/src/routes/CalendarPage.tsx apps/web/src/routes/CalendarPage.test.tsx
git commit -m "fix(web): migrate remaining reservation-state consumers to RequestsContext"
```

---

### Task 10: Migrate `ItemCard` and `ReservationDetailPage` to `RequestsContext`

**Why:** The final whole-branch review found that `ItemCard.tsx` and `ReservationDetailPage.tsx` still import `mockRequests` directly from `@/lib/mockData` — the same staleness bug as #2, missed during the original planning pass. Concretely: `ItemCard`'s "Next 14 days" availability strip and `ReservationDetailPage`'s status line / "Close reservation" button gate don't reflect a status change made via `RequestsContext.setStatus` elsewhere (e.g. approving on `RequestsPage` doesn't turn an item's strip red on `ItemsPage`). This task closes that gap so bug #2 is genuinely fixed everywhere, not just in `RequestsPage`/`DashboardPage`/`DashboardLayout`/`EarningsPage`/`CalendarPage`.

**Files:**
- Modify: `apps/web/src/components/ItemCard.tsx`
- Modify: `apps/web/src/components/ItemCard.test.tsx`
- Modify: `apps/web/src/routes/ReservationDetailPage.tsx`
- Modify: `apps/web/src/routes/ReservationDetailPage.test.tsx`
- Modify: `apps/web/src/routes/ItemsPage.test.tsx` (renders `ItemCard`, needs `RequestsProvider` added to its wrapper)
- Modify: `apps/web/src/routes/PublishItemPage.test.tsx` (renders `ItemCard` for the live preview, same reason)

**Interfaces:**
- Consumes: `useRequests()` from `apps/web/src/lib/RequestsContext.tsx` (Task 7)

- [ ] **Step 1: Migrate `ItemCard.tsx`**

Replace line 6:

```typescript
import { mockRequests } from '@/lib/mockData'
```

with:

```typescript
import { useRequests } from '@/lib/RequestsContext'
```

Add the hook call inside the component, right after `const t = useTranslation()`:

```typescript
  const { requests } = useRequests()
```

Replace line 19 (`const dateRanges = getItemDateStates(item.id, mockRequests)`) with:

```typescript
  const dateRanges = getItemDateStates(item.id, requests)
```

- [ ] **Step 2: Update `ItemCard.test.tsx` to wrap `RequestsProvider`**

Replace `apps/web/src/components/ItemCard.test.tsx` in full:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { RequestsProvider } from '@/lib/RequestsContext'
import { ItemCard } from './ItemCard'

describe('ItemCard', () => {
  it('renders the item name, category label, and the 14-day availability strip for an active item', () => {
    const item = mockItems[0]
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.getByText(item.name)).toBeInTheDocument()
    expect(screen.getByText('Tools')).toBeInTheDocument()
    expect(screen.getByText('Next 14 days')).toBeInTheDocument()
  })

  it('does not render the item name as a link', () => {
    const item = mockItems[0]
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.queryByRole('link', { name: item.name })).not.toBeInTheDocument()
  })

  it('links the Calendar button to the calendar page with the item preselected', () => {
    const item = mockItems[0]
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
        </MemoryRouter>
      </RequestsProvider>,
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
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={onEdit} onDelete={onDelete} />
        </MemoryRouter>
      </RequestsProvider>,
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
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} onReactivate={onReactivate} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.getByText('Inactive · not visible in search')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    expect(onReactivate).toHaveBeenCalledWith(item)
  })

  it('hides all action buttons when readOnly', () => {
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={mockItems[0]} readOnly />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Migrate `ReservationDetailPage.tsx`**

Replace line 3:

```typescript
import { mockRequests, mockTransactions } from '@/lib/mockData'
```

with:

```typescript
import { mockTransactions } from '@/lib/mockData'
import { useRequests } from '@/lib/RequestsContext'
```

Replace lines 11-12:

```typescript
  const { id } = useParams<{ id: string }>()
  const reservation = mockRequests.find((r) => r.id === id)
```

with:

```typescript
  const { id } = useParams<{ id: string }>()
  const { requests } = useRequests()
  const reservation = requests.find((r) => r.id === id)
```

- [ ] **Step 4: Update `ReservationDetailPage.test.tsx` to wrap `RequestsProvider`**

Replace lines 1-6:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockRequests, mockTransactions } from '@/lib/mockData'
import { ReservationDetailPage } from './ReservationDetailPage'
```

with:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockRequests, mockTransactions } from '@/lib/mockData'
import { RequestsProvider } from '@/lib/RequestsContext'
import { ReservationDetailPage } from './ReservationDetailPage'
```

Replace the `render(...)` call (lines 12-18):

```typescript
    render(
      <MemoryRouter initialEntries={[`/reservations/${reservation.id}`]}>
        <Routes>
          <Route path="/reservations/:id" element={<ReservationDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
```

with:

```typescript
    render(
      <RequestsProvider>
        <MemoryRouter initialEntries={[`/reservations/${reservation.id}`]}>
          <Routes>
            <Route path="/reservations/:id" element={<ReservationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </RequestsProvider>,
    )
```

- [ ] **Step 5: Update `ItemsPage.test.tsx`'s `renderPage` to also wrap `RequestsProvider`**

`ItemsPage` renders `ItemCard` for every item, which now calls `useRequests()`. Replace the import block and `renderPage` helper (lines 1-17):

```typescript
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemsProvider } from '@/lib/ItemsContext'
import { ItemsPage } from './ItemsPage'

function renderPage() {
  render(
    <ItemsProvider>
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>
    </ItemsProvider>,
  )
}
```

with:

```typescript
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { ItemsPage } from './ItemsPage'

function renderPage() {
  render(
    <RequestsProvider>
      <ItemsProvider>
        <MemoryRouter>
          <ItemsPage />
        </MemoryRouter>
      </ItemsProvider>
    </RequestsProvider>,
  )
}
```

- [ ] **Step 6: Update `PublishItemPage.test.tsx`'s `renderPage` the same way**

`PublishItemPage`'s live preview also renders `ItemCard`, and its `/items` route renders the full `ItemsPage`. Replace the import block and `renderPage` helper (lines 1-20):

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ItemsProvider } from '@/lib/ItemsContext'
import { PublishItemPage } from './PublishItemPage'
import { ItemsPage } from './ItemsPage'

function renderPage() {
  render(
    <ItemsProvider>
      <MemoryRouter initialEntries={['/items/publish']}>
        <Routes>
          <Route path="/items/publish" element={<PublishItemPage />} />
          <Route path="/items" element={<ItemsPage />} />
        </Routes>
      </MemoryRouter>
    </ItemsProvider>,
  )
}
```

with:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { PublishItemPage } from './PublishItemPage'
import { ItemsPage } from './ItemsPage'

function renderPage() {
  render(
    <RequestsProvider>
      <ItemsProvider>
        <MemoryRouter initialEntries={['/items/publish']}>
          <Routes>
            <Route path="/items/publish" element={<PublishItemPage />} />
            <Route path="/items" element={<ItemsPage />} />
          </Routes>
        </MemoryRouter>
      </ItemsProvider>
    </RequestsProvider>,
  )
}
```

- [ ] **Step 7: Run all affected tests**

Run: `cd apps/web && npx vitest run src/components/ItemCard.test.tsx src/routes/ReservationDetailPage.test.tsx src/routes/ItemsPage.test.tsx src/routes/PublishItemPage.test.tsx`
Expected: PASS, all cases (6 + 1 + 4 + 3 = 14 tests).

- [ ] **Step 8: Run the full suite and the build**

Run: `cd apps/web && npx vitest run`
Expected: PASS, 95/95 (no new tests added — this task migrates existing behavior, doesn't add new cases).

Run: `cd apps/web && npx tsc -b`
Expected: exit 0, no errors (this project's `noUnusedLocals` caught a leftover unused import earlier in this plan — verify no similar leftover here, e.g. if `mockRequests` is still imported anywhere it's no longer used).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ItemCard.tsx apps/web/src/components/ItemCard.test.tsx apps/web/src/routes/ReservationDetailPage.tsx apps/web/src/routes/ReservationDetailPage.test.tsx apps/web/src/routes/ItemsPage.test.tsx apps/web/src/routes/PublishItemPage.test.tsx
git commit -m "fix(web): migrate ItemCard and ReservationDetailPage to RequestsContext"
```

---

## Post-plan state

After Task 9, every one of the 8 confirmed bugs from the review is fixed:

| # | Bug | Fixed in |
|---|-----|----------|
| 1 | Publishing an item never persists | Task 5 |
| 2 | Dashboard/Requests independent state | Tasks 8, 9 |
| 3 | Dashboard KPI disagrees with Requests | Task 8 |
| 4 | Earnings arrow always up | Task 2 |
| 5 | `deltaPct` crash/NaN | Task 2 |
| 6 | Earnings chart breaks on empty data | Task 3 |
| 7 | `getInitials` double-space | Task 1 |
| 8 | Invalid `?item=` silent fallback | Task 6 |

The "ready for just connecting code" part: `ItemsProvider` and `RequestsProvider` are the only two places that know data comes from `mockData.ts`. Swapping to the real API later means replacing each provider's `useState(mockItems)` / `useState(mockRequests)` seed with a `useEffect` that calls `GET /items` / a reservations endpoint, and replacing `addItem`/`updateItem`/`setItemActive`/`setStatus`'s local array mutations with the matching `POST`/`PATCH` calls followed by a re-fetch or optimistic update — no page component changes required, since they already only see `items`/`requests` plus mutation functions, never the mock arrays directly.

Not in scope for this plan (flagged in the review as cleanup/efficiency, not bugs): shared `CATEGORIES` export, status-color lookup table dedup, `StatTile` component extraction, memoizing `RequestsPage`'s tab counts, `ItemCard`'s uncached per-render date-state computation. These don't block "ready for connecting code" and can be done anytime without design decisions.
