# Reactivate Button for Deactivated Items — Design

**Goal:** Add a "Reactivate" button to the owner dashboard (`apps/web`) for soft-deleted items, wiring it to the already-implemented `PATCH /items/{item_id}/reactivate` endpoint (PR #81, merged to `develop`). Owners currently have no way to bring a deleted item back — `ItemCard` renders no action buttons at all once `item.is_active` is `false`.

## Architecture

Mirror the existing Delete flow exactly, layer for layer, since Reactivate is structurally the same mutation as Delete, just inverted:

```
api.ts (apiReactivateItem) → ItemsContext (reactivateItem) → ItemsPage (dialog + handlers) → ItemCard (button)
```

## Components

**`apps/web/src/lib/api.ts`**
New `apiReactivateItem(token, id)`, same shape as `apiDeleteItem`:
```ts
export function apiReactivateItem(token: string, id: string): Promise<Item> {
  return request(`/items/${id}/reactivate`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
}
```

**`apps/web/src/lib/ItemsContext.tsx`**
New `reactivateItem(id)` added to `ItemsContextValue`, mirrors `deleteItem`: calls the API, then refetches the item list on success.

**`apps/web/src/components/ItemCard.tsx`**
New optional prop `onReactivate?: (item: Item) => void`. The existing button row is gated on `!readOnly && item.is_active`; add a second row gated on `!readOnly && !item.is_active` containing a single "Reactivate" button (`variant="outline"`, not `destructive`). Edit/Calendar remain hidden for inactive items — unchanged, explicitly out of scope for this work.

**`apps/web/src/routes/ItemsPage.tsx`**
New state mirroring the delete-confirmation state: `reactivateTarget`, `reactivating`, `reactivateError`. New handlers `handleReactivate(item)` / `confirmReactivate()`, same shape as `handleDelete` / `confirmDelete`. New `Dialog` for the reactivate confirmation — default/primary button styling (not `variant="destructive"`), since reactivating isn't a destructive action. `ItemCard` in the render list gets `onReactivate={handleReactivate}`.

## Copy (i18n, `apps/web/src/lib/i18n/en.ts`)

New keys:
```ts
itemCard: {
  // ...existing...
  reactivate: 'Reactivate',
},
items: {
  // ...existing...
  reactivateDialog: {
    title: 'Reactivate this item?',
    description: (name: string) => `"${name}" will become visible in public search again.`,
    cancel: 'Cancel',
    confirm: 'Reactivate item',
    reactivating: 'Reactivating…',
  },
},
```

Note: `reactivateDialog.confirm` is "Reactivate item," not "Reactivate" — the `ItemCard`'s own button is already labeled "Reactivate," and once the dialog is open both buttons are in the DOM simultaneously. A matching label would be ambiguous for both screen readers and `getByRole('button', { name: 'Reactivate' })` in tests. Same reasoning applies to the delete dialog below.

**Delete dialog copy fix** — the existing copy claims deletion is permanent and irreversible, which becomes false once Reactivate ships:

| | Before | After |
|---|---|---|
| Description | `Deleting "X" is **permanent**. It will disappear from public search and **there is no way to bring it back** — to offer it again later, you'll need to publish it as a new item.` | `Deleting "X" will **hide it from public search**. You can **reactivate it later** from this page if you change your mind.` |
| Confirm button | `Delete permanently` | `Delete item` (not "Delete" — the card's own Delete button is already labeled "Delete" and is visible at the same time the dialog is open) |

`deleteDialog.title` ("Delete this item?") and `deleteDialog.deleting` ("Deleting…") are unchanged.

## Data flow

Same as the existing Delete/Edit mutations in this file: user clicks Reactivate on an `ItemCard` → `ItemsPage` opens the confirmation dialog with that item as `reactivateTarget` → on confirm, `ItemsContext.reactivateItem(id)` calls the API then refetches `/users/me/items` → the refetched list flows back down through `ItemsContext` → `ItemsPage` → `ItemCard`, which now renders the item as active again (availability strip + Edit/Calendar/Delete row) since `is_active` is `true`.

## Error handling

No new error class. Mirrors the delete dialog: API failure sets `reactivateError`, rendered via the existing `AuthErrorBanner` inside the reactivate dialog; the dialog stays open so the user can retry or cancel. Same `getErrorMessage(err, t.errors.network)` fallback pattern already used for delete/edit.

## Testing

Scope: `apps/web` unit/component tests only. `e2e/` is Wa's ownership area per `CLAUDE.md`; a Playwright spec for this flow is left for a follow-up PR there (matches this repo's existing convention — PR #65 added the delete-confirmation feature, PR #66 added its e2e spec as a separate, later PR by Wa).

- **`ItemCard.test.tsx`**: the existing test `'shows no action buttons for an inactive item'` currently asserts `queryByRole('button', { name: 'Reactivate' })` is absent — flip this assertion to present, since that's exactly the button this work adds. Add a new test calling `onReactivate` when the button is clicked, mirroring the existing `onEdit`/`onDelete` click test.
- **`ItemsPage.test.tsx`**: add two tests mirroring the existing delete tests — reactivates an item after confirmation and refetches the list; does not call the API when the reactivate confirmation is dismissed. Update the existing delete test's button-name assertion from `'Delete permanently'` to `'Delete'` (copy change above).
- **`ItemsContext.test.tsx`**: add a `reactivateItem` success-path test mirroring the existing `deleteItem` test.

## Scope

Explicitly out of scope (YAGNI, not requested):
- No changes to `apps/api`, `apps/mobile`, or `packages/contracts/openapi.yaml` — the endpoint already exists and is fully implemented/tested server-side.
- No Edit/Calendar access for inactive items — current behavior (hidden) is unchanged; only Reactivate is added.
- No `e2e/` Playwright spec — left for Wa's follow-up per existing repo convention.
