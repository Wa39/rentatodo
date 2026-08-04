# Item Reactivate Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Reactivate" button to the owner dashboard (`apps/web`) so owners can bring a soft-deleted item back, wired to the already-implemented `PATCH /items/{item_id}/reactivate` endpoint.

**Architecture:** Mirror the existing Delete flow layer-for-layer: `api.ts` (HTTP call) → `ItemsContext.tsx` (mutation + refetch) → `ItemsPage.tsx` (confirmation dialog + handlers) → `ItemCard.tsx` (button). Each layer gets its own commit, following this repo's established pattern for wiring a new action end-to-end (see the `apiCloseReservation` → `closeRequest` → button-wiring commit sequence on `develop`).

**Tech Stack:** React, TypeScript, Vite, Vitest, React Testing Library (existing patterns in `apps/web`).

## Global Constraints

- No backend, contract, or mobile changes — `PATCH /items/{item_id}/reactivate` already exists and is fully implemented/tested server-side (PR #81, merged).
- No Edit/Calendar access for inactive items — unchanged; only Reactivate is added for inactive items.
- No `e2e/` Playwright spec in this plan — `e2e/` is Wa's ownership area per `CLAUDE.md`; left for a follow-up PR there.
- Dialog confirm-button copy must be **"Delete item"** and **"Reactivate item"**, not "Delete"/"Reactivate" — the card's own action button uses the shorter label and is visible in the DOM at the same time the dialog is open, so a matching label would be an ambiguous accessible name for both screen readers and `getByRole` queries in tests.
- Branch: `feature/web-item-reactivate-button` (already cut from `develop`; the design spec commits are already on it).

---

### Task 1: `apiReactivateItem` in the API client

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `request()` (existing helper in `api.ts`), `Item` type (existing import in `api.ts`).
- Produces: `apiReactivateItem(token: string, id: string): Promise<Item>` — consumed by Task 2.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/lib/api.test.ts`, add `apiReactivateItem` to the import list (line 7, right after `apiDeleteItem`):

```ts
  apiDeleteItem,
  apiReactivateItem,
```

Add a new `describe` block directly after the `describe('apiDeleteItem', ...)` block (after its closing `})` around line 289), before `describe('apiListMyRequests', ...)`:

```ts
  describe('apiReactivateItem', () => {
    it('PATCHes /items/{id}/reactivate with a Bearer token and resolves with the reactivated item', async () => {
      const payload = {
        id: 'i1',
        name: 'Taladro Bosch Professional',
        description: 'desc',
        category: 'tools',
        price_per_day: 5000,
        photo_url: 'https://example.com/p.jpg',
        is_active: true,
        owner_id: 'u1',
        owner_name: 'María Vargas',
        created_at: '2026-01-01T00:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiReactivateItem('tok123', 'i1')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/items/i1/reactivate',
        expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError with the code/message from a 404 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, 404))

      await expect(apiReactivateItem('tok123', 'missing')).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Item not found' })
    })
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: FAIL — `apiReactivateItem` is not exported from `./api`.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/api.ts`, add directly after `apiDeleteItem` (after its closing `}`, currently lines 116-118):

```ts
export function apiReactivateItem(token: string, id: string): Promise<Item> {
  return request(`/items/${id}/reactivate`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat(web): add apiReactivateItem"
```

---

### Task 2: `reactivateItem` in ItemsContext

**Files:**
- Modify: `apps/web/src/lib/ItemsContext.tsx`
- Test: `apps/web/src/lib/ItemsContext.test.tsx`

**Interfaces:**
- Consumes: `apiReactivateItem(token: string, id: string): Promise<Item>` (Task 1), `refetch(currentToken: string)` (existing private helper in `ItemsContext.tsx`).
- Produces: `reactivateItem(id: string): Promise<void>` on `ItemsContextValue` — consumed by Task 4.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/lib/ItemsContext.test.tsx`, add a `reactivate` button to the `Probe` component. Replace the `Probe` function (lines 42-75) with:

```tsx
function Probe() {
  const { items, loading, error, addItem, updateItem, deleteItem, reactivateItem } = useItems()
  const { logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'idle'}</span>
      <span data-testid="error">{error ?? ''}</span>
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
            photo_url: 'https://example.com/new.jpg',
          }).catch(() => {})
        }
      >
        add
      </button>
      <button onClick={() => updateItem('i1', { name: 'Renamed' }).catch(() => {})}>update</button>
      <button onClick={() => deleteItem('i1').catch(() => {})}>delete</button>
      <button onClick={() => reactivateItem('i1').catch(() => {})}>reactivate</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}
```

Add a new test directly after the `it('deleteItem DELETEs the item then refetches the list showing it as inactive', ...)` test (after its closing `})` around line 267), before the `it('discards a stale in-flight response from a mutation-triggered refetch...`:

```tsx
  it('reactivateItem PATCHes the item then refetches the list showing it as active', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [
        () => jsonResponse([{ ...ITEM, is_active: false }], 200),
        () => jsonResponse([{ ...ITEM, is_active: true }], 200),
      ],
      '/items/i1/reactivate': [() => jsonResponse({ ...ITEM, is_active: true }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    expect(screen.getByText('Taladro Bosch Professional · inactive')).toBeInTheDocument()

    act(() => screen.getByText('reactivate').click())

    await waitFor(() => expect(screen.getByText('Taladro Bosch Professional · active')).toBeInTheDocument())
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/ItemsContext.test.tsx`
Expected: FAIL — `reactivateItem` is `undefined` on the context value (TypeScript/runtime error calling `.catch` on `undefined(...)`), and the new test fails since the button's `onClick` throws.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/ItemsContext.tsx`, update the import (lines 2-11) to add `apiReactivateItem`:

```ts
import {
  apiCreateItem,
  apiDeleteItem,
  apiListMyItems,
  apiReactivateItem,
  apiUpdateItem,
  ApiError,
  getErrorMessage,
  type CreateItemPayload,
  type UpdateItemPayload,
} from './api'
```

Add to the `ItemsContextValue` interface (lines 16-23), after `deleteItem`:

```ts
interface ItemsContextValue {
  items: Item[]
  loading: boolean
  error: string | null
  addItem: (data: CreateItemPayload) => Promise<void>
  updateItem: (id: string, data: UpdateItemPayload) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  reactivateItem: (id: string) => Promise<void>
}
```

Add the function directly after `deleteItem` (after its closing `}`, currently lines 86-90):

```ts
  async function reactivateItem(id: string) {
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Not authenticated')
    await apiReactivateItem(token, id)
    await refetch(token)
  }
```

Update the `value` object (currently line 92):

```ts
  const value: ItemsContextValue = { items, loading, error, addItem, updateItem, deleteItem, reactivateItem }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/ItemsContext.test.tsx`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ItemsContext.tsx apps/web/src/lib/ItemsContext.test.tsx
git commit -m "feat(web): add reactivateItem to ItemsContext"
```

---

### Task 3: Reactivate button on ItemCard

**Files:**
- Modify: `apps/web/src/lib/i18n/en.ts`
- Modify: `apps/web/src/components/ItemCard.tsx`
- Test: `apps/web/src/components/ItemCard.test.tsx`

**Interfaces:**
- Consumes: `t.itemCard.reactivate` (new i18n key this task adds), existing `Item` type, existing `Button` component.
- Produces: `ItemCard`'s new `onReactivate?: (item: Item) => void` prop — consumed by Task 4.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/components/ItemCard.test.tsx`, replace the `it('shows no action buttons for an inactive item', ...)` test (lines 78-94) with:

```tsx
  it('shows only the Reactivate button for an inactive item', () => {
    const item = mockItems.find((i) => !i.is_active)!
    render(
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} onReactivate={vi.fn()} />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
    )
    expect(screen.getByText('Inactive · not visible in search')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  it('calls onReactivate when the Reactivate button is clicked', async () => {
    const user = userEvent.setup()
    const onReactivate = vi.fn()
    const item = mockItems.find((i) => !i.is_active)!
    render(
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={item} onReactivate={onReactivate} />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    expect(onReactivate).toHaveBeenCalledWith(item)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/ItemCard.test.tsx`
Expected: FAIL — `screen.getByRole('button', { name: 'Reactivate' })` finds no element (no such button rendered yet).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/i18n/en.ts`, in the `itemCard` block (currently lines 67-74), add `reactivate` after `delete`:

```ts
  itemCard: {
    next14Days: 'Next 14 days',
    inactive: 'Inactive · not visible in search',
    edit: 'Edit',
    calendar: 'Calendar',
    delete: 'Delete',
    reactivate: 'Reactivate',
    perDay: '/day',
  },
```

In `apps/web/src/components/ItemCard.tsx`, add `onReactivate` to `ItemCardProps` (lines 9-14):

```tsx
interface ItemCardProps {
  item: Item
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  onReactivate?: (item: Item) => void
  readOnly?: boolean
}
```

Add `onReactivate` to the function signature (line 16):

```tsx
export function ItemCard({ item, onEdit, onDelete, onReactivate, readOnly = false }: ItemCardProps) {
```

Add a new button row directly after the existing active-item button row's closing `)}` (currently lines 65-77), before the closing `</div>` / `</div>` of the card:

```tsx
        {!readOnly && !item.is_active && (
          <div className="flex gap-two pt-one">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onReactivate?.(item)}>
              {t.itemCard.reactivate}
            </Button>
          </div>
        )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/ItemCard.test.tsx`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/i18n/en.ts apps/web/src/components/ItemCard.tsx apps/web/src/components/ItemCard.test.tsx
git commit -m "feat(web): add Reactivate button to ItemCard for inactive items"
```

---

### Task 4: Wire the reactivate confirmation dialog into ItemsPage, fix delete copy

**Files:**
- Modify: `apps/web/src/lib/i18n/en.ts`
- Modify: `apps/web/src/routes/ItemsPage.tsx`
- Test: `apps/web/src/routes/ItemsPage.test.tsx`

**Interfaces:**
- Consumes: `reactivateItem(id: string): Promise<void>` (Task 2), `onReactivate` prop on `ItemCard` (Task 3), `t.items.reactivateDialog` / `t.items.deleteDialog` (this task adds/edits), existing `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` components, existing `AuthErrorBanner`, existing `getErrorMessage`.
- Produces: nothing consumed by a later task — this is the final integration point.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/routes/ItemsPage.test.tsx`, update the existing delete test's confirm-button assertion (currently line 164) from `'Delete permanently'` to `'Delete item'`:

```tsx
    await user.click(screen.getByRole('button', { name: 'Delete item' }))
```

Add two new tests directly after the `it('does not call the API when the delete confirmation is dismissed', ...)` test (after its closing `})`, currently ending at line 220), before the `describe` block's closing `})`:

```tsx
  it('reactivates an item after confirmation and refetches the list', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [
        () => jsonResponse(ITEMS, 200),
        () => jsonResponse([ITEMS[0], { ...ITEMS[1], is_active: true }], 200),
      ],
      '/items/i2/reactivate': [() => jsonResponse({ ...ITEMS[1], is_active: true }, 200)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    const item = ITEMS[1]
    await waitFor(() => expect(screen.getByText(item.name)).toBeInTheDocument())
    const card = screen.getByTestId(`item-card-${item.id}`)
    await user.click(within(card).getByRole('button', { name: 'Reactivate' }))
    expect(screen.getByText('Reactivate this item?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reactivate item' }))
    await waitFor(() =>
      expect(within(screen.getByTestId(`item-card-${item.id}`)).queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument(),
    )
  })

  it('does not call the API when the reactivate confirmation is dismissed', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse(ITEMS, 200)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    const item = ITEMS[1]
    await waitFor(() => expect(screen.getByText(item.name)).toBeInTheDocument())
    const card = screen.getByTestId(`item-card-${item.id}`)
    await user.click(within(card).getByRole('button', { name: 'Reactivate' }))
    expect(screen.getByText('Reactivate this item?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText('Reactivate this item?')).not.toBeInTheDocument())
    expect(within(card).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run src/routes/ItemsPage.test.tsx`
Expected: FAIL — the updated delete test fails because the button is still named "Delete permanently"; the two new tests fail because clicking "Reactivate" on the card does nothing (no `onReactivate` wired) and no reactivate dialog exists.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/i18n/en.ts`, replace the `deleteDialog` block (currently lines 90-100) and add `reactivateDialog` after it:

```ts
    deleteDialog: {
      title: 'Delete this item?',
      descriptionPrefix: (name: string) => `Deleting "${name}" will `,
      descriptionEmphasis1: 'hide it from public search',
      descriptionMiddle: '. You can ',
      descriptionEmphasis2: 'reactivate it later',
      descriptionSuffix: ' from this page if you change your mind.',
      cancel: 'Cancel',
      confirm: 'Delete item',
      deleting: 'Deleting…',
    },
    reactivateDialog: {
      title: 'Reactivate this item?',
      description: (name: string) => `"${name}" will become visible in public search again.`,
      cancel: 'Cancel',
      confirm: 'Reactivate item',
      reactivating: 'Reactivating…',
    },
```

In `apps/web/src/routes/ItemsPage.tsx`, destructure `reactivateItem` from `useItems()` (currently line 23):

```tsx
  const { items, loading, error, updateItem, deleteItem, reactivateItem } = useItems()
```

Add new state directly after the existing delete state (currently lines 32-34):

```tsx
  const [reactivateTarget, setReactivateTarget] = useState<Item | null>(null)
  const [reactivating, setReactivating] = useState(false)
  const [reactivateError, setReactivateError] = useState<string | null>(null)
```

Add new handlers directly after `confirmDelete` (after its closing `}`, currently lines 88-100):

```tsx
  function handleReactivate(item: Item) {
    setReactivateError(null)
    setReactivateTarget(item)
  }

  async function confirmReactivate() {
    if (!reactivateTarget) return
    setReactivating(true)
    setReactivateError(null)
    try {
      await reactivateItem(reactivateTarget.id)
      setReactivateTarget(null)
    } catch (err) {
      setReactivateError(getErrorMessage(err, t.errors.network))
    } finally {
      setReactivating(false)
    }
  }
```

Add the confirm button's text change to `t.items.deleteDialog.confirm` — no code change needed here since the JSX already reads `{t.items.deleteDialog.confirm}` (the i18n edit above is sufficient).

Add a new `Dialog` directly after the existing delete `Dialog`'s closing `</Dialog>` (currently line 211), before the `{loading ? (` block:

```tsx
        <Dialog open={reactivateTarget !== null} onOpenChange={(next) => { if (!reactivating && !next) setReactivateTarget(null) }}>
          <DialogContent className="max-w-md gap-5 p-7">
            <DialogHeader>
              <DialogTitle className="text-xl">{t.items.reactivateDialog.title}</DialogTitle>
              <DialogDescription className="text-base leading-relaxed text-foreground/90">
                {reactivateTarget && t.items.reactivateDialog.description(reactivateTarget.name)}
              </DialogDescription>
            </DialogHeader>
            <AuthErrorBanner message={reactivateError} />
            <DialogFooter className="sm:justify-center sm:space-x-3">
              <Button type="button" disabled={reactivating} onClick={confirmReactivate}>
                {reactivating ? t.items.reactivateDialog.reactivating : t.items.reactivateDialog.confirm}
              </Button>
              <Button type="button" variant="outline" disabled={reactivating} onClick={() => setReactivateTarget(null)}>
                {t.items.reactivateDialog.cancel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
```

Update the `ItemCard` render call (currently line 218) to pass the new handler:

```tsx
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onEdit={openEditDialog} onDelete={handleDelete} onReactivate={handleReactivate} />
            ))}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/ItemsPage.test.tsx`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Run the full web test suite and typecheck to check for regressions**

Run: `cd apps/web && npx vitest run && npx tsc -b`
Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/i18n/en.ts apps/web/src/routes/ItemsPage.tsx apps/web/src/routes/ItemsPage.test.tsx
git commit -m "feat(web): wire Reactivate button into ItemsPage and fix delete-dialog copy"
```

---

### Task 5: Manual verification, push, open PR

**Files:** None (verification + git/PR operations only).

- [ ] **Step 1: Manually verify in the browser**

With the web dev server running (`cd apps/web && npm run dev`) and the API running with at least one deactivated item (delete an item through the UI first if needed):

1. Open `/items`. Confirm an inactive item shows only a "Reactivate" button (no Edit/Calendar/Delete).
2. Click "Reactivate". Confirm the dialog shows the correct item name and a "Reactivate item" / "Cancel" button pair.
3. Click "Cancel". Confirm the dialog closes and the item is still inactive.
4. Click "Reactivate" again, then click "Reactivate item". Confirm the dialog closes and the item now shows as active (availability strip + Edit/Calendar/Delete buttons).
5. Delete an active item. Confirm the dialog's new copy reads correctly ("will hide it from public search... You can reactivate it later...") and the confirm button says "Delete item".

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feature/web-item-reactivate-button
```

- [ ] **Step 3: Open the PR**

```bash
gh pr create --base develop --title "feat(web): add reactivate button for deleted items" --body "$(cat <<'EOF'
## Summary
- Adds a "Reactivate" button to inactive items on the owner dashboard, wired to the existing `PATCH /items/{item_id}/reactivate` endpoint (PR #81).
- New layers mirror the existing Delete flow: `apiReactivateItem` (api.ts) → `reactivateItem` (ItemsContext) → confirmation dialog + handlers (ItemsPage) → button (ItemCard).
- Fixes the delete-confirmation dialog copy, which previously claimed deletion was permanent and irreversible — no longer true now that Reactivate exists.
- Client-side only — no backend, contract, or mobile changes; the endpoint already exists and is fully tested server-side.

## Test plan
- New tests: 2 in `api.test.ts` (happy path, 404), 1 in `ItemsContext.test.tsx` (PATCH + refetch), 2 in `ItemCard.test.tsx` (renders for inactive items, click handler), 2 in `ItemsPage.test.tsx` (happy path, cancelled confirmation). 1 existing `ItemsPage.test.tsx` test updated for the delete dialog's new confirm-button copy.
- Full `apps/web` suite green, `tsc -b` clean.
- Manually verified in the browser: reactivate button appears only on inactive items, confirmation dialog works, cancel leaves state unchanged, confirm reactivates and refetches, delete dialog copy reads correctly.
EOF
)"
```
