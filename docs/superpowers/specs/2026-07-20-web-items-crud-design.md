# Wire Items CRUD to the Real API — Design

## What this is

Replaces `apps/web`'s mock `ItemsContext` (a `useState` seeded from
`mockData.ts`, never touching the network) with a real integration against
`apps/api`'s six live Items endpoints. This follows the same pattern
established by `2026-07-17-web-connect-login-design.md` for Auth — same
`api.ts` fetch wrapper, same `ApiError`/error-banner conventions, same
async-submit-with-loading-state shape on the forms.

Scope is `apps/web` only. `apps/api`'s Items endpoints are already
implemented and merged to `develop` (PR #16, PR #24) — nothing on the
backend needs to change for this design.

## Current state (before this change)

- `apps/web/src/lib/ItemsContext.tsx`: holds `items` in `useState(mockItems)`.
  `addItem`/`updateItem`/`setItemActive` are synchronous, local-only, never
  call `fetch`. `setItemActive(id, true)` is used as a "reactivate" action.
- `apps/web/src/routes/PublishItemPage.tsx`: `handleSubmit` calls `addItem`
  synchronously with `owner_id`/`owner_name` taken from `mockUser`, then
  navigates immediately — no error path exists because nothing can fail.
- `apps/web/src/routes/ItemsPage.tsx`: edit dialog calls `updateItem`
  synchronously. `handleDelete` calls `setItemActive(id, false)` after a
  `window.confirm`. A reactivate button calls `setItemActive(id, true)`.
- `apps/web/src/components/ItemCard.tsx`: renders a "Reactivate" button
  for inactive items, wired to `onReactivate`.
- `apps/web/src/routes/DashboardPage.tsx`: imports `mockItems` directly
  (not via `useItems()`) to compute the "Active items" KPI.
- `apps/web/src/lib/AuthContext.tsx`: holds `token` in state but does not
  expose it on `AuthContextValue` — nothing outside the module currently
  needs it.

## What's live on the API (confirmed against `packages/contracts/openapi.yaml`
and `apps/api/app/routers/items.py`, `apps/api/app/schemas/item.py`)

- `POST /items` — auth required. Body `CreateItemRequest`
  (`name`, `description`, `category`, `price_per_day` in centavos,
  `photo_url`) — no `owner_id`/`owner_name`, always derived from the JWT.
  Returns `201` with `ItemResponse`, or `422` on invalid data.
- `GET /users/me/items` — auth required. Returns a bare array of
  `ItemResponse` (not paginated, not wrapped), active and inactive items
  both included.
- `PATCH /items/{id}` — auth required, owner-only. Body `UpdateItemRequest`
  (all fields optional — omitted means unchanged). Returns `200` with
  `ItemResponse`, `403` if not the owner, `404` if not found, `422` on
  invalid data.
- `DELETE /items/{id}` — auth required, owner-only. Soft-delete
  (`is_active = false`), one-way — **no endpoint exists to set
  `is_active` back to `true`**. Returns `200` with the deactivated
  `ItemResponse`, `403`/`404` same as PATCH.
- `GET /items` (public listing) and `GET /items/{id}` (public detail) are
  not used by this design — `apps/web` is the owner dashboard, not a
  public catalog. `POST /uploads/presign` is spec-only, not implemented on
  `apps/api` yet — out of scope, see below.

## Architecture

```
apps/web/src/lib/api.ts              (modify) — add 4 item functions
apps/web/src/lib/AuthContext.tsx     (modify) — expose `token` on context value
apps/web/src/lib/ItemsContext.tsx    (rewrite) — real CRUD, loading/error state
apps/web/src/routes/PublishItemPage.tsx (modify) — async submit, error banner
apps/web/src/routes/ItemsPage.tsx    (modify) — async edit/delete, drop reactivate
apps/web/src/components/ItemCard.tsx (modify) — drop onReactivate + button
apps/web/src/routes/DashboardPage.tsx (modify) — read items from useItems()
apps/web/src/lib/i18n/en.ts          (modify) — drop itemCard.reactivate, add submitting/error keys
```

### `apps/web/src/lib/api.ts`

Four new functions, same `request<T>` helper and `ApiError` already used
for auth:

```ts
interface CreateItemPayload {
  name: string
  description: string
  category: Category
  price_per_day: number
  photo_url: string
}
type UpdateItemPayload = Partial<CreateItemPayload>

export function apiCreateItem(token: string, data: CreateItemPayload): Promise<Item> {
  return request('/items', { method: 'POST', body: JSON.stringify(data), headers: { Authorization: `Bearer ${token}` } })
}

export function apiListMyItems(token: string): Promise<Item[]> {
  return request('/users/me/items', { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
}

export function apiUpdateItem(token: string, id: string, data: UpdateItemPayload): Promise<Item> {
  return request(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data), headers: { Authorization: `Bearer ${token}` } })
}

export function apiDeleteItem(token: string, id: string): Promise<Item> {
  return request(`/items/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}
```

`Category`/`Item` types are imported from `lib/types.ts`, which already
matches `ItemResponse` field-for-field — no type changes needed there.

### `apps/web/src/lib/AuthContext.tsx`

Add `token: string | null` to `AuthContextValue` and return the existing
`token` state variable. No behavior change — purely exposing state that
already exists internally, so `ItemsContext` (mounted inside
`AuthProvider`, per `App.tsx`) can read it via `useAuth()`.

### `apps/web/src/lib/ItemsContext.tsx`

```ts
interface ItemsContextValue {
  items: Item[]
  loading: boolean
  error: string | null
  addItem: (data: CreateItemPayload) => Promise<void>
  updateItem: (id: string, data: UpdateItemPayload) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}
```

`ItemsProvider` reads `token` from `useAuth()`. A `useEffect` keyed on
`token`: if `token` is non-null, set `loading = true`, call
`apiListMyItems(token)`, populate `items` on success or `error` (via
`getErrorMessage`) on failure, then `loading = false`. If `token` is
null (logged out), reset `items` to `[]`.

`addItem`/`updateItem`/`deleteItem` each: call the corresponding `api.ts`
function, and **on success, re-fetch `GET /users/me/items`** rather than
splicing the mutation's response into local state (per the approved
refetch-over-optimistic-update strategy — guarantees `items` always
matches what the server has, including fields the server computes like
`owner_name`/`created_at`). They do not catch `ApiError`/network
errors — they propagate to the caller (`PublishItemPage`/`ItemsPage`),
matching how `AuthContext.login`/`register` already work, so each page
controls its own error banner and submit-button state.

`setItemActive`/reactivate is removed entirely — replaced by `deleteItem`
only, since the API has no reverse operation.

### `apps/web/src/routes/PublishItemPage.tsx`

- `const { user } = useAuth()` replaces `mockUser` for the preview card's
  `owner_name`/`owner_id`.
- New `const [submitting, setSubmitting] = useState(false)` and
  `const [error, setError] = useState<string | null>(null)`.
- `handleSubmit` becomes `async`: `setSubmitting(true); setError(null)`,
  `await addItem({ name, description, category, price_per_day, photo_url })`
  (no `owner_id`/`owner_name` — the API derives them), `navigate('/items')`
  on success. On failure: `setError(getErrorMessage(err, t.errors.network))`,
  stay on the page with the form's values intact. `finally { setSubmitting(false) }`.
- Submit button gets `disabled={submitting}`, label swaps to
  `t.publish.submitting` (new i18n key, `"Publishing…"`) while submitting.
- `AuthErrorBanner`-style `<p>` renders above the form when `error` is set
  (reuse the existing component, it's generic already).

### `apps/web/src/routes/ItemsPage.tsx`

- Reads `loading`, `error` from `useItems()` alongside `items`.
- A loading message renders in place of the grid while `loading` is true
  on first mount (new i18n key `t.items.loading`, `"Loading your
  items…"`); the fetch-failed case reuses the `AuthErrorBanner` pattern
  (new i18n key `t.items.loadError` used as the fallback for
  `getErrorMessage`).
- Edit dialog's `handleSubmit` becomes `async`, wraps `updateItem` in the
  same `try/catch/finally` shape as `PublishItemPage`, with its own
  `submitting`/`error` state local to the dialog. Dialog stays open on
  error so the user doesn't lose their edits.
- `handleDelete` becomes `async`: after the existing `window.confirm`,
  `await deleteItem(item.id)` inside try/catch; on failure, shows the
  error via `window.alert(getErrorMessage(err, t.errors.network))` (no
  dedicated banner for this one — it's a fire-and-forget action outside
  any form, matching the existing `window.confirm` UX already in this
  handler rather than introducing a new UI pattern for one action).
- `handleReactivate` and the `onReactivate` prop passed to `ItemCard` are
  removed.

### `apps/web/src/components/ItemCard.tsx`

Remove the `onReactivate` prop and the inactive-item action row's
"Reactivate" button. Inactive items keep only the "Edit" button (editing
fields is still possible via `PATCH`, it just can't flip `is_active`).

### `apps/web/src/routes/DashboardPage.tsx`

`const activeItems = mockItems.filter(...)` becomes
`const { items } = useItems(); const activeItems = items.filter((i) => i.is_active).length`
— the KPI reflects real data instead of the static mock array, which
would otherwise silently go stale as soon as items become real elsewhere
on the same dashboard.

### `apps/web/src/lib/i18n/en.ts`

- Remove `itemCard.reactivate`.
- Add `publish.submitting: 'Publishing…'`.
- Add `items.loading: 'Loading your items…'`.
- Add `items.loadError: "Couldn't load your items. Try refreshing the page."`
  (used only as the `getErrorMessage` fallback, not a literal API message).

## Data flow

**Load:** `ItemsPage` mounts → `ItemsProvider`'s effect (already ran once
`token` was set at login, or reruns if `token` changes) → `GET
/users/me/items` → `items` populated, `loading = false`.

**Publish:** user submits form → `PublishItemPage` calls
`addItem({...})` → `ItemsContext` calls `POST /items` → on success,
re-fetches `GET /users/me/items` → `PublishItemPage` navigates to
`/items`. On `422` (e.g. invalid category), the error banner shows the
API's message, user stays on the form with their input intact.

**Edit:** user opens the edit dialog, changes fields, submits → `PATCH
/items/{id}` → on success, refetch, dialog closes. On `403`/`404`/`422`,
dialog stays open with the error shown inline.

**Delete:** user confirms via `window.confirm` → `DELETE /items/{id}` →
on success, refetch (item now shows as inactive, no longer offers
delete/reactivate — only Edit). On failure, `window.alert` with the
error message, item list unchanged.

## Error handling

Same three-tier pattern as the Auth design:
1. HTML5 form validation (unchanged — `required`, `min`/`step` on price).
2. `ApiError` with a `message` straight from the API's `{error: {message}}`.
3. Network failure (`fetch` rejects) — caught the same way, shown via the
   new `t.errors.network` fallback, already defined for Auth and reused
   here.

## Testing

Same no-new-dependency approach as `AuthContext.test.tsx`:
`vi.spyOn(global, 'fetch')` per test, `jsonResponse()` helper, mock
per-call sequencing with `mockResolvedValueOnce`.

- `ItemsContext.test.tsx`: rewritten — asserts `addItem`/`updateItem`/
  `deleteItem` call the right method+path+body+auth header and trigger a
  refetch afterward; asserts `items` populates from `GET
  /users/me/items` on mount when a token exists and stays `[]` when it
  doesn't; asserts a failed initial fetch sets `error` without throwing
  into the render tree.
- `PublishItemPage.test.tsx`: mock a successful `POST /items` +
  refetch (navigates to `/items`); mock a `422` (shows error banner,
  form values intact, does not navigate).
- `ItemsPage.test.tsx`: mock initial `GET /users/me/items`; mock a
  successful edit (dialog closes, refetch happens); mock a successful
  delete (confirm dialog stubbed via `vi.spyOn(window, 'confirm')`
  returning `true`, same pattern probably already used for the existing
  mock version — verify and reuse); reactivate-related test cases are
  deleted, not adapted.
- `ItemCard.test.tsx`: drop reactivate-button assertions.
- `DashboardPage.test.tsx`: update to seed items via a mocked
  `ItemsProvider` fetch instead of relying on `mockItems`.
- `beforeEach(() => vi.spyOn(global, 'fetch'))` /
  `afterEach(() => vi.restoreAllMocks())` in each rewritten file, matching
  `AuthContext.test.tsx`.

## Explicitly out of scope for this PR

- **Camera capture / real file upload.** `POST /uploads/presign` is
  spec-only on `apps/api` (contract merged in PR #37, implementation not
  started per `apps/api/ROADMAP.md`). The Publish/Edit forms keep the
  existing pasted-`photo_url` text field. A follow-up PR will add a
  `capture="environment"` file input + presigned S3 upload once Trucy
  ships the endpoint.
- **Reactivating a deactivated item.** No API support exists; the
  feature is removed from the UI rather than faked client-side.
- **The public `GET /items` browse/search endpoint** — not relevant to
  the owner dashboard.
- **`apps/api` changes of any kind.**
- **Any other mock data (`mockRequests`, `mockTransactions`,
  `mockEarnings`) being wired to the real API** — separate, later work.
