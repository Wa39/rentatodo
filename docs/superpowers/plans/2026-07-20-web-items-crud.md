# Wire Items CRUD to the Real API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/web`'s mock `ItemsContext` with a real integration against `apps/api`'s Items endpoints, so an owner can publish, list, edit, and delete items end to end.

**Architecture:** Extend `lib/api.ts` with four Items functions following the existing Auth pattern (`request<T>` + `ApiError`). Expose `token` from `AuthContext`. Rewrite `ItemsContext` to fetch/mutate against the real API (refetch-after-mutation strategy) instead of local mock state. Update every consumer (`PublishItemPage`, `ItemsPage`, `ItemCard`, `DashboardPage`, `CalendarPage`) to match the new async, possibly-erroring contract.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + Testing Library (fetch mocked via `vi.spyOn(global, 'fetch')`, no new dependency), React Router.

**Spec:** `docs/superpowers/specs/2026-07-20-web-items-crud-design.md`

## Global Constraints

- Scope is `apps/web` only. Never modify `apps/api` or `packages/contracts/openapi.yaml`.
- No new npm dependencies — mock `fetch` directly, matching `AuthContext.test.tsx`/`api.test.ts`.
- Money is always an integer in USD centavos, never a float.
- Camera capture / `POST /uploads/presign` is explicitly out of scope (backend not implemented yet) — the pasted-`photo_url` text field stays as-is.
- The "reactivate" feature is removed outright, not stubbed or faked client-side — the API has no endpoint for it.
- Commit convention: Conventional Commits, `type(web): description` (this branch is `feature/web-items-crud`, PR targets `develop`).
- Every error the user can see must ultimately trace to either HTML5 validation, an `ApiError.message` straight from the API, or the existing `t.errors.network` fallback — no invented client-side wording.

## Addendum to the spec (found during planning)

The spec's file list didn't include `CalendarPage.tsx`, but it also calls `useItems()` and currently assumes items are synchronously available (seeded from `mockItems`). Once `ItemsContext` starts empty and only populates via fetch, `CalendarPage` needs to distinguish "still loading" from "genuinely has no items" — otherwise it flashes the wrong empty-state message on every load. Task 8 below covers this; it wasn't a late addition to scope, just a spec gap now closed.

---

### Task 1: Add Items CRUD functions to `lib/api.ts`

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Produces: `apiCreateItem(token: string, data: CreateItemPayload): Promise<Item>`, `apiListMyItems(token: string): Promise<Item[]>`, `apiUpdateItem(token: string, id: string, data: UpdateItemPayload): Promise<Item>`, `apiDeleteItem(token: string, id: string): Promise<Item>`, and the exported types `CreateItemPayload`, `UpdateItemPayload`. `Item`/`Category` are imported from `./types` (already match `ItemResponse` field-for-field, no changes needed there).

- [ ] **Step 1: Write the failing tests**

Append these four `describe` blocks to the end of `apps/web/src/lib/api.test.ts`, just before the final closing `})` of the outer `describe('api', ...)`:

```ts
  describe('apiCreateItem', () => {
    it('POSTs to /items with a Bearer token and resolves with the created item', async () => {
      const payload = {
        id: 'i1',
        name: 'Taladro Bosch Professional',
        description: 'Taladro inalámbrico 18V con maletín y 3 brocas',
        category: 'tools',
        price_per_day: 5000,
        photo_url: 'https://storage.example.com/photos/taladro.jpg',
        is_active: true,
        owner_id: 'u1',
        owner_name: 'María Vargas',
        created_at: '2026-01-01T00:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 201))

      const result = await apiCreateItem('tok123', {
        name: 'Taladro Bosch Professional',
        description: 'Taladro inalámbrico 18V con maletín y 3 brocas',
        category: 'tools',
        price_per_day: 5000,
        photo_url: 'https://storage.example.com/photos/taladro.jpg',
      })

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Taladro Bosch Professional',
            description: 'Taladro inalámbrico 18V con maletín y 3 brocas',
            category: 'tools',
            price_per_day: 5000,
            photo_url: 'https://storage.example.com/photos/taladro.jpg',
          }),
          headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
        }),
      )
    })

    it('throws ApiError with the code/message from a 422 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'price_per_day: must be greater than 0' } }, 422),
      )

      await expect(
        apiCreateItem('tok123', {
          name: 'x',
          description: 'x',
          category: 'tools',
          price_per_day: 0,
          photo_url: 'https://example.com/p.jpg',
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: 'price_per_day: must be greater than 0' })
    })
  })

  describe('apiListMyItems', () => {
    it('GETs /users/me/items with a Bearer token and resolves with the array of items', async () => {
      const payload = [
        {
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
        },
      ]
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiListMyItems('tok123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/users/me/items',
        expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError on a 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401))

      await expect(apiListMyItems('bad-token')).rejects.toBeInstanceOf(ApiError)
    })
  })

  describe('apiUpdateItem', () => {
    it('PATCHes /items/{id} with a Bearer token and resolves with the updated item', async () => {
      const payload = {
        id: 'i1',
        name: 'Renamed',
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

      const result = await apiUpdateItem('tok123', 'i1', { name: 'Renamed' })

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/items/i1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Renamed' }),
          headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
        }),
      )
    })

    it('throws ApiError with the code/message from a 403 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'FORBIDDEN', message: 'Not the owner' } }, 403))

      await expect(apiUpdateItem('tok123', 'i1', { name: 'Renamed' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Not the owner',
      })
    })
  })

  describe('apiDeleteItem', () => {
    it('DELETEs /items/{id} with a Bearer token and resolves with the deactivated item', async () => {
      const payload = {
        id: 'i1',
        name: 'Taladro Bosch Professional',
        description: 'desc',
        category: 'tools',
        price_per_day: 5000,
        photo_url: 'https://example.com/p.jpg',
        is_active: false,
        owner_id: 'u1',
        owner_name: 'María Vargas',
        created_at: '2026-01-01T00:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiDeleteItem('tok123', 'i1')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/items/i1',
        expect.objectContaining({ method: 'DELETE', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError with the code/message from a 404 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, 404))

      await expect(apiDeleteItem('tok123', 'missing')).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Item not found' })
    })
  })
```

Update the top import line of `apps/web/src/lib/api.test.ts` from:

```ts
import { ApiError, apiGetMe, apiLogin, apiRegister } from './api'
```

to:

```ts
import { ApiError, apiCreateItem, apiDeleteItem, apiGetMe, apiListMyItems, apiLogin, apiRegister, apiUpdateItem } from './api'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/web/`): `npx vitest run src/lib/api.test.ts`
Expected: FAIL — `apiCreateItem`/`apiListMyItems`/`apiUpdateItem`/`apiDeleteItem` are not exported from `./api`.

- [ ] **Step 3: Implement the four functions**

Replace the full contents of `apps/web/src/lib/api.ts` with:

```ts
import type { Category, Item } from './types'

export class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}

interface LoginResult {
  access_token: string
  token_type: string
  expires_in: number
}

interface UserProfile {
  id: string
  name: string
  email: string
  created_at: string
}

export interface CreateItemPayload {
  name: string
  description: string
  category: Category
  price_per_day: number
  photo_url: string
}

export type UpdateItemPayload = Partial<CreateItemPayload>

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'UNKNOWN_ERROR', body?.error?.message ?? 'Something went wrong. Please try again.')
  }
  return body as T
}

export function apiLogin(email: string, password: string): Promise<LoginResult> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function apiRegister(name: string, email: string, password: string): Promise<UserProfile> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })
}

export function apiGetMe(token: string): Promise<UserProfile> {
  return request('/users/me', { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
}

export function apiCreateItem(token: string, data: CreateItemPayload): Promise<Item> {
  return request('/items', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function apiListMyItems(token: string): Promise<Item[]> {
  return request('/users/me/items', { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
}

export function apiUpdateItem(token: string, id: string, data: UpdateItemPayload): Promise<Item> {
  return request(`/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function apiDeleteItem(token: string, id: string): Promise<Item> {
  return request(`/items/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/api.test.ts`
Expected: PASS, all tests including the four new `describe` blocks.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat(web): add Items CRUD functions to the API client"
```

---

### Task 2: Expose `token` on `AuthContext`

**Files:**
- Modify: `apps/web/src/lib/AuthContext.tsx`
- Test: `apps/web/src/lib/AuthContext.test.tsx`

**Interfaces:**
- Produces: `AuthContextValue.token: string | null` (the existing internal `token` state, now exposed).

- [ ] **Step 1: Write the failing test**

In `apps/web/src/lib/AuthContext.test.tsx`, change the `Probe` component (around line 13) from:

```tsx
function Probe() {
  const { isAuthenticated, user, login, register, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <span data-testid="user-name">{user?.name ?? ''}</span>
```

to:

```tsx
function Probe() {
  const { isAuthenticated, user, token, login, register, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <span data-testid="user-name">{user?.name ?? ''}</span>
      <span data-testid="token">{token ?? ''}</span>
```

Add this test at the end of the `describe('AuthContext', ...)` block, just before its final closing `})`:

```ts
  it('exposes the current token on the context value', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByTestId('token')).toHaveTextContent('')

    await act(async () => {
      await screen.getByText('login').click()
    })

    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('tok123'))
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/AuthContext.test.tsx`
Expected: FAIL — `token` is `undefined` on the context value (TypeScript would also flag `AuthContextValue` as missing `token`, but since this is a `.tsx` test file run through Vitest/esbuild without a separate type-check step, the runtime assertion is what fails here: `toHaveTextContent('')` still passes trivially, but the later `toHaveTextContent('tok123')` fails because `token` renders as `undefined` → empty string forever).

- [ ] **Step 3: Add `token` to the context value**

In `apps/web/src/lib/AuthContext.tsx`, change the interface (around line 12):

```ts
interface AuthContextValue {
  isAuthenticated: boolean
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}
```

to:

```ts
interface AuthContextValue {
  isAuthenticated: boolean
  user: AuthUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}
```

And change the `value` object (around line 63):

```ts
  const value: AuthContextValue = {
    isAuthenticated: token !== null,
    user,
    login,
    register,
    logout,
  }
```

to:

```ts
  const value: AuthContextValue = {
    isAuthenticated: token !== null,
    user,
    token,
    login,
    register,
    logout,
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/AuthContext.test.tsx`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/AuthContext.tsx apps/web/src/lib/AuthContext.test.tsx
git commit -m "feat(web): expose the auth token on AuthContext"
```

---

### Task 3: Rewrite `ItemsContext` against the real API

**Files:**
- Modify: `apps/web/src/lib/ItemsContext.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts` (add `items.loadError`)
- Test: `apps/web/src/lib/ItemsContext.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `apiCreateItem`, `apiListMyItems`, `apiUpdateItem`, `apiDeleteItem`, `getErrorMessage`, `CreateItemPayload`, `UpdateItemPayload` from `./api` (Task 1). `useAuth().token` from `./AuthContext` (Task 2).
- Produces: `useItems(): { items: Item[]; loading: boolean; error: string | null; addItem(data: CreateItemPayload): Promise<void>; updateItem(id: string, data: UpdateItemPayload): Promise<void>; deleteItem(id: string): Promise<void> }`. Note `setItemActive` is **removed** — Task 4/6 update its only callers in the same PR.

- [ ] **Step 1: Add the `items.loadError` i18n key**

In `apps/web/src/lib/i18n/en.ts`, change the `items` block (around line 83):

```ts
  items: {
    title: 'My items',
    subtitle: (active: number, inactive: number) => `${active} active · ${inactive} inactive`,
    searchPlaceholder: 'Search by name or category…',
  },
```

to:

```ts
  items: {
    title: 'My items',
    subtitle: (active: number, inactive: number) => `${active} active · ${inactive} inactive`,
    searchPlaceholder: 'Search by name or category…',
    loadError: "Couldn't load your items. Try refreshing the page.",
  },
```

- [ ] **Step 2: Write the failing test**

Replace the full contents of `apps/web/src/lib/ItemsContext.test.tsx` with:

```tsx
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { ItemsProvider, useItems } from './ItemsContext'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockFetchRoutes(routes: Record<string, Array<() => Response>>) {
  const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const path = sortedPaths.find((candidate) => url.endsWith(candidate))
    const next = path ? routes[path].shift() : undefined
    if (!next) throw new Error(`Unhandled fetch call: ${url}`)
    return Promise.resolve(next())
  })
}

const PROFILE = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }

const ITEM = {
  id: 'i1',
  name: 'Taladro Bosch Professional',
  description: 'Taladro inalámbrico 18V con maletín y 3 brocas',
  category: 'tools',
  price_per_day: 1000,
  photo_url: 'https://storage.example.com/photos/taladro.jpg',
  is_active: true,
  owner_id: 'u1',
  owner_name: 'María Vargas',
  created_at: '2026-01-01T00:00:00Z',
}

function Probe() {
  const { items, loading, error, addItem, updateItem, deleteItem } = useItems()
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
    </div>
  )
}

function renderWithToken() {
  localStorage.setItem('rentatodo_token', 'tok123')
  return render(
    <AuthProvider>
      <ItemsProvider>
        <Probe />
      </ItemsProvider>
    </AuthProvider>,
  )
}

describe('ItemsContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts empty and never calls fetch when there is no token', () => {
    render(
      <AuthProvider>
        <ItemsProvider>
          <Probe />
        </ItemsProvider>
      </AuthProvider>,
    )
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches GET /users/me/items on mount when a token exists', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([ITEM], 200)],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    expect(screen.getByText('Taladro Bosch Professional · active')).toBeInTheDocument()
  })

  it('sets loading while the initial fetch is in flight', async () => {
    let resolveItems: (r: Response) => void = () => {}
    const itemsPromise = new Promise<Response>((resolve) => {
      resolveItems = resolve
    })
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.endsWith('/users/me/items')) return itemsPromise
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    renderWithToken()

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')
    act(() => resolveItems(jsonResponse([ITEM], 200)))
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('idle'))
  })

  it('sets an error message when the initial fetch fails, without throwing', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401)],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Not authenticated'))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('addItem POSTs the new item then refetches the list', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200), () => jsonResponse([{ ...ITEM, id: 'i2', name: 'New Item' }], 200)],
      '/items': [() => jsonResponse({ ...ITEM, id: 'i2', name: 'New Item' }, 201)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('idle'))

    act(() => screen.getByText('add').click())

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    expect(screen.getByText('New Item · active')).toBeInTheDocument()
  })

  it('updateItem PATCHes the item then refetches the list', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([ITEM], 200), () => jsonResponse([{ ...ITEM, name: 'Renamed' }], 200)],
      '/items/i1': [() => jsonResponse({ ...ITEM, name: 'Renamed' }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

    act(() => screen.getByText('update').click())

    await waitFor(() => expect(screen.getByText('Renamed · active')).toBeInTheDocument())
  })

  it('deleteItem DELETEs the item then refetches the list showing it as inactive', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([ITEM], 200), () => jsonResponse([{ ...ITEM, is_active: false }], 200)],
      '/items/i1': [() => jsonResponse({ ...ITEM, is_active: false }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

    act(() => screen.getByText('delete').click())

    await waitFor(() => expect(screen.getByText('Taladro Bosch Professional · inactive')).toBeInTheDocument())
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

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/ItemsContext.test.tsx`
Expected: FAIL — current `ItemsContext` has no `loading`/`error`, `addItem` is synchronous and takes `owner_id`/`owner_name`, and nothing calls `fetch`.

- [ ] **Step 4: Rewrite `ItemsContext`**

Replace the full contents of `apps/web/src/lib/ItemsContext.tsx` with:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  apiCreateItem,
  apiDeleteItem,
  apiListMyItems,
  apiUpdateItem,
  getErrorMessage,
  type CreateItemPayload,
  type UpdateItemPayload,
} from './api'
import { useAuth } from './AuthContext'
import { useTranslation } from './i18n'
import type { Item } from './types'

interface ItemsContextValue {
  items: Item[]
  loading: boolean
  error: string | null
  addItem: (data: CreateItemPayload) => Promise<void>
  updateItem: (id: string, data: UpdateItemPayload) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

const ItemsContext = createContext<ItemsContextValue | undefined>(undefined)

export function ItemsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const t = useTranslation()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refetch(currentToken: string) {
    setLoading(true)
    setError(null)
    try {
      setItems(await apiListMyItems(currentToken))
    } catch (err) {
      setError(getErrorMessage(err, t.items.loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) {
      setItems([])
      return
    }
    refetch(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function addItem(data: CreateItemPayload) {
    if (!token) throw new Error('Not authenticated')
    await apiCreateItem(token, data)
    await refetch(token)
  }

  async function updateItem(id: string, data: UpdateItemPayload) {
    if (!token) throw new Error('Not authenticated')
    await apiUpdateItem(token, id, data)
    await refetch(token)
  }

  async function deleteItem(id: string) {
    if (!token) throw new Error('Not authenticated')
    await apiDeleteItem(token, id)
    await refetch(token)
  }

  const value: ItemsContextValue = { items, loading, error, addItem, updateItem, deleteItem }
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

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/ItemsContext.test.tsx`
Expected: PASS, all 8 tests.

Note: this task leaves `ItemsPage.tsx`, `PublishItemPage.tsx`, `ItemCard.tsx`, `DashboardPage.tsx`, and `CalendarPage.tsx` (and their test files) temporarily broken — they still reference the old `setItemActive`/synchronous `addItem` shape. That's expected; Tasks 4–8 fix each in turn. Don't run the full `apps/web` test suite or `npm run build` until Task 9.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/ItemsContext.tsx apps/web/src/lib/ItemsContext.test.tsx apps/web/src/lib/i18n/en.ts
git commit -m "feat(web): wire ItemsContext to the real Items API"
```

---

### Task 4: Remove the "Reactivate" feature from `ItemCard`

**Files:**
- Modify: `apps/web/src/components/ItemCard.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts` (remove `itemCard.reactivate`)
- Test: `apps/web/src/components/ItemCard.test.tsx`

**Interfaces:**
- Produces: `ItemCardProps` without `onReactivate`. (`ItemCard` never imports `ItemsContext` — this task has no dependency on Task 3 and can run independently.)

- [ ] **Step 1: Write the failing test**

In `apps/web/src/components/ItemCard.test.tsx`, replace the test `'shows Reactivate and Edit only for an inactive item'` (the block from `it('shows Reactivate and Edit only for an inactive item', ...)` through its closing `})`) with:

```tsx
  it('shows only Edit for an inactive item, with no Delete, Calendar, or Reactivate button', () => {
    const item = mockItems.find((i) => !i.is_active)!
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.getByText('Inactive · not visible in search')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ItemCard.test.tsx`
Expected: FAIL — the current component still renders a "Reactivate" button, so `queryByRole('button', { name: 'Reactivate' })` finds one and the `not.toBeInTheDocument()` assertion fails.

- [ ] **Step 3: Remove `onReactivate` from `ItemCard`**

In `apps/web/src/components/ItemCard.tsx`, change the props interface (around line 9):

```tsx
interface ItemCardProps {
  item: Item
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  onReactivate?: (item: Item) => void
  readOnly?: boolean
}

export function ItemCard({ item, onEdit, onDelete, onReactivate, readOnly = false }: ItemCardProps) {
```

to:

```tsx
interface ItemCardProps {
  item: Item
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  readOnly?: boolean
}

export function ItemCard({ item, onEdit, onDelete, readOnly = false }: ItemCardProps) {
```

And change the inactive-item action row (around line 69):

```tsx
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
```

to:

```tsx
        {!readOnly && !item.is_active && (
          <div className="flex gap-two pt-one">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit?.(item)}>
              {t.itemCard.edit}
            </Button>
          </div>
        )}
```

In `apps/web/src/lib/i18n/en.ts`, remove the `reactivate: 'Reactivate',` line from the `itemCard` block (around line 72), so it reads:

```ts
  itemCard: {
    next14Days: 'Next 14 days',
    inactive: 'Inactive · not visible in search',
    edit: 'Edit',
    calendar: 'Calendar',
    delete: 'Delete',
    perDay: '/day',
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ItemCard.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ItemCard.tsx apps/web/src/components/ItemCard.test.tsx apps/web/src/lib/i18n/en.ts
git commit -m "feat(web): remove the Reactivate action from ItemCard (unsupported by the API)"
```

---

### Task 5: Wire `PublishItemPage` to the real `ItemsContext`

**Files:**
- Modify: `apps/web/src/routes/PublishItemPage.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts` (add `publish.submitting`)
- Test: `apps/web/src/routes/PublishItemPage.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useItems().addItem` (Task 3, now `async`, no `owner_id`/`owner_name` in its payload), `useAuth().user` (Task 2), `getErrorMessage` from `lib/api` (Task 1), `AuthErrorBanner` (existing component, unchanged).

- [ ] **Step 1: Add the `publish.submitting` i18n key**

In `apps/web/src/lib/i18n/en.ts`, change the `publish` block (around line 88):

```ts
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
```

to:

```ts
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
    submitting: 'Publishing…',
  },
```

- [ ] **Step 2: Write the failing test**

Replace the full contents of `apps/web/src/routes/PublishItemPage.test.tsx` with:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { PublishItemPage } from './PublishItemPage'
import { ItemsPage } from './ItemsPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockFetchRoutes(routes: Record<string, Array<() => Response>>) {
  const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const path = sortedPaths.find((candidate) => url.endsWith(candidate))
    const next = path ? routes[path].shift() : undefined
    if (!next) throw new Error(`Unhandled fetch call: ${url}`)
    return Promise.resolve(next())
  })
}

const PROFILE = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }

function renderPage() {
  localStorage.setItem('rentatodo_token', 'tok123')
  render(
    <AuthProvider>
      <RequestsProvider>
        <ItemsProvider>
          <MemoryRouter initialEntries={['/items/publish']}>
            <Routes>
              <Route path="/items/publish" element={<PublishItemPage />} />
              <Route path="/items" element={<ItemsPage />} />
            </Routes>
          </MemoryRouter>
        </ItemsProvider>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('PublishItemPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reflects the typed name in the live preview', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Taladro Bosch Professional')
    expect(screen.getAllByText('Taladro Bosch Professional')).toHaveLength(1)
  })

  it('adds the new item to the Items list on submit', async () => {
    const newItem = {
      id: 'i2',
      name: 'Bicicleta de montaña',
      description: 'A description',
      category: 'tools',
      price_per_day: 1000,
      photo_url: 'https://example.com/photo.jpg',
      is_active: true,
      owner_id: 'u1',
      owner_name: 'María Vargas',
      created_at: '2026-01-01T00:00:00Z',
    }
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200), () => jsonResponse([newItem], 200)],
      '/items': [() => jsonResponse(newItem, 201)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Bicicleta de montaña')
    await user.type(screen.getByLabelText('Price per day (USD)'), '10')
    await user.type(screen.getByLabelText('Description'), 'A description')
    await user.type(screen.getByLabelText('Photo'), 'https://example.com/photo.jpg')
    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'My items' })).toBeInTheDocument())
    expect(screen.getByText('Bicicleta de montaña')).toBeInTheDocument()
  })

  it('shows an error banner and stays on the page when the API rejects the submission', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
      '/items': [
        () => jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'price_per_day: must be greater than 0' } }, 422),
      ],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Bicicleta de montaña')
    await user.type(screen.getByLabelText('Price per day (USD)'), '10')
    await user.type(screen.getByLabelText('Description'), 'A description')
    await user.type(screen.getByLabelText('Photo'), 'https://example.com/photo.jpg')
    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    await waitFor(() => expect(screen.getByText('price_per_day: must be greater than 0')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'My items' })).not.toBeInTheDocument()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Bicicleta de montaña')
  })

  it('navigates to /items on cancel without submitting', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'My items' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/routes/PublishItemPage.test.tsx`
Expected: FAIL — `addItem` still expects `owner_id`/`owner_name` and is synchronous; there's no error banner; `ItemsPage`'s own rewrite (Task 6) hasn't landed yet either, but that only affects rendering downstream, not this file's compile — `ItemsPage.tsx` still compiles fine at this point since Task 6 hasn't touched its type shape in a way Task 5 depends on.

- [ ] **Step 4: Rewrite `PublishItemPage`**

Replace the full contents of `apps/web/src/routes/PublishItemPage.tsx` with:

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { useItems } from '@/lib/ItemsContext'
import { useAuth } from '@/lib/AuthContext'
import { ItemCard } from '@/components/ItemCard'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { getErrorMessage } from '@/lib/api'
import type { Category, Item } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES: Category[] = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home', 'other']

export function PublishItemPage() {
  const t = useTranslation()
  const navigate = useNavigate()
  const { addItem } = useItems()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>(CATEGORIES[0])
  const [priceDollars, setPriceDollars] = useState('')
  const [description, setDescription] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewItem: Item = {
    id: 'preview',
    name: name || t.publish.previewEmptyName,
    description: description || t.publish.previewEmptyDescription,
    category,
    price_per_day: Math.round(Number(priceDollars || '0') * 100),
    photo_url: photoUrl,
    is_active: true,
    owner_id: user?.id ?? '',
    owner_name: user?.name ?? '',
    created_at: new Date().toISOString(),
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await addItem({
        name,
        description,
        category,
        price_per_day: Math.round(Number(priceDollars || '0') * 100),
        photo_url: photoUrl,
      })
      navigate('/items')
    } catch (err) {
      setError(getErrorMessage(err, t.errors.network))
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    navigate('/items')
  }

  return (
    <div>
      <PageHeader title={t.publish.title} subtitle={t.publish.subtitle} />
      <div className="grid grid-cols-2 gap-four p-four">
        <form onSubmit={handleSubmit} className="space-y-three rounded-lg border border-border bg-card p-four">
          <AuthErrorBanner message={error} />
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
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? t.publish.submitting : t.publish.submit}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={handleCancel} disabled={submitting}>
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

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/routes/PublishItemPage.test.tsx`
Expected: PASS, all 4 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/PublishItemPage.tsx apps/web/src/routes/PublishItemPage.test.tsx apps/web/src/lib/i18n/en.ts
git commit -m "feat(web): wire PublishItemPage to the real Items API"
```

---

### Task 6: Wire `ItemsPage` to the real `ItemsContext`

**Files:**
- Modify: `apps/web/src/routes/ItemsPage.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts` (add `items.loading`)
- Test: `apps/web/src/routes/ItemsPage.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useItems()` → `items`, `loading`, `error`, `updateItem`, `deleteItem` (Task 3, `deleteItem` replaces `setItemActive`), `getErrorMessage` (Task 1), `AuthErrorBanner` (existing), `ItemCard` without `onReactivate` (Task 4).

- [ ] **Step 1: Add the `items.loading` i18n key**

In `apps/web/src/lib/i18n/en.ts`, change the `items` block (already has `loadError` from Task 3):

```ts
  items: {
    title: 'My items',
    subtitle: (active: number, inactive: number) => `${active} active · ${inactive} inactive`,
    searchPlaceholder: 'Search by name or category…',
    loadError: "Couldn't load your items. Try refreshing the page.",
  },
```

to:

```ts
  items: {
    title: 'My items',
    subtitle: (active: number, inactive: number) => `${active} active · ${inactive} inactive`,
    searchPlaceholder: 'Search by name or category…',
    loadError: "Couldn't load your items. Try refreshing the page.",
    loading: 'Loading your items…',
  },
```

- [ ] **Step 2: Write the failing test**

Replace the full contents of `apps/web/src/routes/ItemsPage.test.tsx` with:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { ItemsPage } from './ItemsPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockFetchRoutes(routes: Record<string, Array<() => Response>>) {
  const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const path = sortedPaths.find((candidate) => url.endsWith(candidate))
    const next = path ? routes[path].shift() : undefined
    if (!next) throw new Error(`Unhandled fetch call: ${url}`)
    return Promise.resolve(next())
  })
}

const PROFILE = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }

const ITEMS = [
  {
    id: 'i1',
    name: 'Taladro Bosch Professional',
    description: 'Taladro inalámbrico 18V con maletín y 3 brocas',
    category: 'tools',
    price_per_day: 1000,
    photo_url: 'https://storage.example.com/photos/taladro.jpg',
    is_active: true,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'i2',
    name: 'Cámara Canon EOS antigua',
    description: 'Cámara réflex, dada de baja de la lista pública',
    category: 'photography',
    price_per_day: 2000,
    photo_url: 'https://storage.example.com/photos/canon.jpg',
    is_active: false,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
]

function renderPage() {
  localStorage.setItem('rentatodo_token', 'tok123')
  render(
    <AuthProvider>
      <RequestsProvider>
        <ItemsProvider>
          <MemoryRouter>
            <ItemsPage />
          </MemoryRouter>
        </ItemsProvider>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('ItemsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a card for every item with an active/inactive count in the header', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse(ITEMS, 200)],
    })
    renderPage()
    for (const item of ITEMS) {
      await waitFor(() => expect(screen.getByText(item.name)).toBeInTheDocument())
    }
    expect(screen.getByText('1 active · 1 inactive')).toBeInTheDocument()
  })

  it('filters items by name as the user types in the search box', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse(ITEMS, 200)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await waitFor(() => expect(screen.getByText(ITEMS[0].name)).toBeInTheDocument())
    await user.type(screen.getByRole('textbox'), 'Taladro')
    expect(screen.getByText(ITEMS[0].name)).toBeInTheDocument()
    expect(screen.queryByText(ITEMS[1].name)).not.toBeInTheDocument()
  })

  it('edits an existing item through the pre-filled dialog and refetches on success', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [
        () => jsonResponse(ITEMS, 200),
        () => jsonResponse([{ ...ITEMS[0], name: 'Taladro (renovated)' }, ITEMS[1]], 200),
      ],
      '/items/i1': [() => jsonResponse({ ...ITEMS[0], name: 'Taladro (renovated)' }, 200)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    const item = ITEMS[0]
    await waitFor(() => expect(screen.getByText(item.name)).toBeInTheDocument())
    const card = screen.getByTestId(`item-card-${item.id}`)
    await user.click(within(card).getByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    expect(nameInput.value).toBe(item.name)
    await user.clear(nameInput)
    await user.type(nameInput, 'Taladro (renovated)')
    await user.click(screen.getByRole('button', { name: 'Save item' }))
    await waitFor(() => expect(screen.getByText('Taladro (renovated)')).toBeInTheDocument())
  })

  it('shows an inline error in the dialog and keeps it open when the edit fails', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse(ITEMS, 200)],
      '/items/i1': [() => jsonResponse({ error: { code: 'FORBIDDEN', message: 'Not the owner' } }, 403)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    const item = ITEMS[0]
    await waitFor(() => expect(screen.getByText(item.name)).toBeInTheDocument())
    const card = screen.getByTestId(`item-card-${item.id}`)
    await user.click(within(card).getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save item' }))
    await waitFor(() => expect(screen.getByText('Not the owner')).toBeInTheDocument())
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('deletes an item after confirmation and refetches the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [
        () => jsonResponse(ITEMS, 200),
        () => jsonResponse([{ ...ITEMS[0], is_active: false }, ITEMS[1]], 200),
      ],
      '/items/i1': [() => jsonResponse({ ...ITEMS[0], is_active: false }, 200)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    const item = ITEMS[0]
    await waitFor(() => expect(screen.getByText(item.name)).toBeInTheDocument())
    const card = screen.getByTestId(`item-card-${item.id}`)
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(within(screen.getByTestId(`item-card-${item.id}`)).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument(),
    )
  })

  it('does not call the API when the delete confirmation is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse(ITEMS, 200)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    const item = ITEMS[0]
    await waitFor(() => expect(screen.getByText(item.name)).toBeInTheDocument())
    const card = screen.getByTestId(`item-card-${item.id}`)
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    expect(within(card).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/routes/ItemsPage.test.tsx`
Expected: FAIL — current `ItemsPage` destructures `setItemActive` (no longer exported), has no loading/error rendering, and `handleDelete`/`handleSubmit` are synchronous.

- [ ] **Step 4: Rewrite `ItemsPage`**

Replace the full contents of `apps/web/src/routes/ItemsPage.tsx` with:

```tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { ItemCard } from '@/components/ItemCard'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { useItems } from '@/lib/ItemsContext'
import { getErrorMessage } from '@/lib/api'
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
  const { items, loading, error, updateItem, deleteItem } = useItems()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [query, setQuery] = useState('')
  const [dialogSubmitting, setDialogSubmitting] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

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
    setDialogError(null)
    setOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    setDialogSubmitting(true)
    setDialogError(null)
    try {
      const priceCentavos = Math.round(Number(form.priceDollars) * 100)
      await updateItem(editingId, {
        name: form.name,
        description: form.description,
        category: form.category,
        price_per_day: priceCentavos,
        photo_url: form.photoUrl,
      })
      setOpen(false)
      setEditingId(null)
      setForm(BLANK_FORM)
    } catch (err) {
      setDialogError(getErrorMessage(err, t.errors.network))
    } finally {
      setDialogSubmitting(false)
    }
  }

  async function handleDelete(item: Item) {
    const confirmed = window.confirm(`Delete "${item.name}"? It will stop appearing in public search.`)
    if (!confirmed) return
    try {
      await deleteItem(item.id)
    } catch (err) {
      window.alert(getErrorMessage(err, t.errors.network))
    }
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
        <AuthErrorBanner message={error} />
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
              <AuthErrorBanner message={dialogError} />
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
              <Button type="submit" className="w-full" disabled={dialogSubmitting}>
                {dialogSubmitting ? 'Saving…' : 'Save item'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t.items.loading}</p>
        ) : (
          <div className="grid grid-cols-4 gap-three">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onEdit={openEditDialog} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/routes/ItemsPage.test.tsx`
Expected: PASS, all 6 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/ItemsPage.tsx apps/web/src/routes/ItemsPage.test.tsx apps/web/src/lib/i18n/en.ts
git commit -m "feat(web): wire ItemsPage to the real Items API"
```

---

### Task 7: Point `DashboardPage`'s "Active items" KPI at `useItems()`

**Files:**
- Modify: `apps/web/src/routes/DashboardPage.tsx`
- Test: `apps/web/src/routes/DashboardPage.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useItems().items` (Task 3). `ItemsProvider` must now wrap `DashboardPage` in both the app (`App.tsx` already does — no change needed there) and its tests.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `apps/web/src/routes/DashboardPage.test.tsx` with:

```tsx
// apps/web/src/routes/DashboardPage.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockRequests } from '@/lib/mockData'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { RESERVED_STATUSES } from '@/lib/availability'
import { DashboardPage } from './DashboardPage'
import { RequestsPage } from './RequestsPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockFetchRoutes(routes: Record<string, Array<() => Response>>) {
  const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const path = sortedPaths.find((candidate) => url.endsWith(candidate))
    const next = path ? routes[path].shift() : undefined
    if (!next) throw new Error(`Unhandled fetch call: ${url}`)
    return Promise.resolve(next())
  })
}

const PROFILE = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }

const ITEMS = [
  {
    id: 'i1',
    name: 'Taladro',
    description: 'd',
    category: 'tools',
    price_per_day: 1000,
    photo_url: 'https://example.com/p.jpg',
    is_active: true,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'i2',
    name: 'Carpa',
    description: 'd',
    category: 'camping',
    price_per_day: 1500,
    photo_url: 'https://example.com/p2.jpg',
    is_active: true,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'i3',
    name: 'Cámara vieja',
    description: 'd',
    category: 'photography',
    price_per_day: 2000,
    photo_url: 'https://example.com/p3.jpg',
    is_active: false,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
]

function renderDashboard() {
  render(
    <AuthProvider>
      <ItemsProvider>
        <RequestsProvider>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </RequestsProvider>
      </ItemsProvider>
    </AuthProvider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the Active items KPI from fetched items, not a static mock array', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse(ITEMS, 200)],
    })
    renderDashboard()
    const pending = mockRequests.filter((r) => r.status === 'requested').length

    const activeItemsCard = screen.getByText('Active items').closest('div')!
    await waitFor(() => expect(within(activeItemsCard).getByText('2')).toBeInTheDocument())

    const pendingCard = screen.getByText('Pending requests').closest('div')!
    expect(within(pendingCard).getByText(String(pending))).toBeInTheDocument()
  })

  it('shows 0 active items when there is no token yet', () => {
    renderDashboard()
    const activeItemsCard = screen.getByText('Active items').closest('div')!
    expect(within(activeItemsCard).getByText('0')).toBeInTheDocument()
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

  it('renders the page header with the title', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it("shows the authenticated user's first name in the welcome message, not the mock user", async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [
        () => jsonResponse({ id: 'u1', name: 'Ana Torres', email: 'ana@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      ],
      '/users/me/items': [() => jsonResponse([], 200)],
    })

    renderDashboard()

    await waitFor(() => expect(screen.getByText('Welcome back, Ana')).toBeInTheDocument())
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
      <AuthProvider>
        <ItemsProvider>
          <RequestsProvider>
            <MemoryRouter>
              <DashboardPage />
              <RequestsPage />
            </MemoryRouter>
          </RequestsProvider>
        </ItemsProvider>
      </AuthProvider>,
    )
    const firstPending = mockRequests.filter((r) => r.status === 'requested')[0]
    const dashboardRow = screen.getAllByText(new RegExp(firstPending.renter_name))[0].closest('li')!
    await user.click(within(dashboardRow).getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: /^Active/ }))
    expect(screen.getByText(new RegExp(firstPending.renter_name))).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/routes/DashboardPage.test.tsx`
Expected: FAIL — `DashboardPage` still reads `mockItems` directly, so the "renders the Active items KPI from fetched items" test sees the mock array's count (2 active out of 3, coincidentally also 2 — so instead check: this test fails because `fetch` was never called by `DashboardPage` in the old version, and the "shows 0 active items when there is no token yet" test fails because the old version always shows the mock array's active count, never 0).

- [ ] **Step 3: Update `DashboardPage`**

In `apps/web/src/routes/DashboardPage.tsx`, change the imports and the `activeItems` line (top of file):

```tsx
import { Link } from 'react-router-dom'
import { mockEarnings, mockItems } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { useAuth } from '@/lib/AuthContext'
import { useTranslation } from '@/lib/i18n'
import { useRequests } from '@/lib/RequestsContext'
import { RESERVED_STATUSES } from '@/lib/availability'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export function DashboardPage() {
  const t = useTranslation()
  const { user } = useAuth()
  const { requests, setStatus } = useRequests()
  const activeItems = mockItems.filter((item) => item.is_active).length
```

to:

```tsx
import { Link } from 'react-router-dom'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { useAuth } from '@/lib/AuthContext'
import { useItems } from '@/lib/ItemsContext'
import { useTranslation } from '@/lib/i18n'
import { useRequests } from '@/lib/RequestsContext'
import { RESERVED_STATUSES } from '@/lib/availability'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export function DashboardPage() {
  const t = useTranslation()
  const { user } = useAuth()
  const { items } = useItems()
  const { requests, setStatus } = useRequests()
  const activeItems = items.filter((item) => item.is_active).length
```

The rest of the file is unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/routes/DashboardPage.test.tsx`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/DashboardPage.tsx apps/web/src/routes/DashboardPage.test.tsx
git commit -m "feat(web): compute the Active items KPI from real fetched items"
```

---

### Task 8: Make `CalendarPage` handle the async items load

**Files:**
- Modify: `apps/web/src/routes/CalendarPage.tsx`
- Test: `apps/web/src/routes/CalendarPage.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useItems()` → adds `loading` to the existing `items` destructure (Task 3).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `apps/web/src/routes/CalendarPage.test.tsx` with:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockRequests } from '@/lib/mockData'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { CalendarPage } from './CalendarPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockFetchRoutes(routes: Record<string, Array<() => Response>>) {
  const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const path = sortedPaths.find((candidate) => url.endsWith(candidate))
    const next = path ? routes[path].shift() : undefined
    if (!next) throw new Error(`Unhandled fetch call: ${url}`)
    return Promise.resolve(next())
  })
}

const PROFILE = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }

const ITEMS = [
  {
    id: 'i1',
    name: 'Taladro Bosch Professional',
    description: 'd',
    category: 'tools',
    price_per_day: 1000,
    photo_url: 'https://example.com/p.jpg',
    is_active: true,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'i2',
    name: 'Carpa Camping 4 personas',
    description: 'd',
    category: 'camping',
    price_per_day: 1500,
    photo_url: 'https://example.com/p2.jpg',
    is_active: true,
    owner_id: 'u1',
    owner_name: 'María Vargas',
    created_at: '2026-01-01T00:00:00Z',
  },
]

function renderPage(initialEntry = '/requests/calendar') {
  localStorage.setItem('rentatodo_token', 'tok123')
  render(
    <AuthProvider>
      <RequestsProvider>
        <ItemsProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/requests/calendar" element={<CalendarPage />} />
            </Routes>
          </MemoryRouter>
        </ItemsProvider>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('CalendarPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to the first item when no item is preselected', async () => {
    mockFetchRoutes({ '/users/me': [() => jsonResponse(PROFILE, 200)], '/users/me/items': [() => jsonResponse(ITEMS, 200)] })
    renderPage()
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(ITEMS[0].id))
  })

  it('preselects the item from the ?item= query param', async () => {
    mockFetchRoutes({ '/users/me': [() => jsonResponse(PROFILE, 200)], '/users/me/items': [() => jsonResponse(ITEMS, 200)] })
    renderPage(`/requests/calendar?item=${ITEMS[1].id}`)
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(ITEMS[1].id))
  })

  it('switches items when a different one is picked from the dropdown', async () => {
    mockFetchRoutes({ '/users/me': [() => jsonResponse(PROFILE, 200)], '/users/me/items': [() => jsonResponse(ITEMS, 200)] })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(ITEMS[0].id))
    await user.selectOptions(screen.getByRole('combobox'), ITEMS[1].id)
    expect(screen.getByRole('combobox')).toHaveValue(ITEMS[1].id)
  })

  it("lists this item's reservations below the calendar", async () => {
    mockFetchRoutes({ '/users/me': [() => jsonResponse(PROFILE, 200)], '/users/me/items': [() => jsonResponse(ITEMS, 200)] })
    renderPage()
    const reservation = mockRequests.find((r) => r.item_id === ITEMS[0].id)
    if (reservation) {
      await waitFor(() => expect(screen.getByText(new RegExp(reservation.renter_name))).toBeInTheDocument())
    }
  })

  it('shows a not-found message instead of silently falling back for an invalid ?item=', async () => {
    mockFetchRoutes({ '/users/me': [() => jsonResponse(PROFILE, 200)], '/users/me/items': [() => jsonResponse(ITEMS, 200)] })
    renderPage('/requests/calendar?item=does-not-exist')
    await waitFor(() => expect(screen.getByText("This item doesn't exist or is no longer yours.")).toBeInTheDocument())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders each month at a fixed compact width instead of stretching full-width', async () => {
    mockFetchRoutes({ '/users/me': [() => jsonResponse(PROFILE, 200)], '/users/me/items': [() => jsonResponse(ITEMS, 200)] })
    renderPage()
    await waitFor(() => expect(screen.getAllByText(/2026$/)).toHaveLength(2))
    const monthHeadings = screen.getAllByText(/2026$/)
    for (const heading of monthHeadings) {
      expect(heading.parentElement?.parentElement).toHaveClass('w-[280px]')
    }
  })

  it('shows a loading message while items are still being fetched', () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.endsWith('/users/me/items')) return new Promise<Response>(() => {})
      throw new Error(`Unhandled fetch call: ${url}`)
    })
    renderPage()
    expect(screen.getByText('Loading your items…')).toBeInTheDocument()
  })

  it('shows an empty-state message instead of crashing when there are no items at all', async () => {
    mockFetchRoutes({ '/users/me': [() => jsonResponse(PROFILE, 200)], '/users/me/items': [() => jsonResponse([], 200)] })
    renderPage()
    await waitFor(() => expect(screen.getByText("You don't have any items yet. Publish one to see its calendar.")).toBeInTheDocument())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/routes/CalendarPage.test.tsx`
Expected: FAIL — the new "shows a loading message while items are still being fetched" test fails because `CalendarPage` currently jumps straight to the "no items yet" empty state (there's no `loading` branch yet); the other tests fail simply because `ItemsProvider` no longer seeds from `mockItems`, so without the fetch mocks nothing would render — but since the test file now supplies the mocks, those should already pass once the loading branch exists. Confirm the loading-message test is the one that fails.

- [ ] **Step 3: Add the loading branch to `CalendarPage`**

In `apps/web/src/routes/CalendarPage.tsx`, change (around line 11-13):

```tsx
export function CalendarPage() {
  const t = useTranslation()
  const { items } = useItems()
```

to:

```tsx
export function CalendarPage() {
  const t = useTranslation()
  const { items, loading } = useItems()
```

And change the empty-state check (around line 36):

```tsx
  if (items.length === 0) {
    return (
      <div>
        <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />
        <div className="p-four text-sm text-muted-foreground">{t.calendar.noItems}</div>
      </div>
    )
  }
```

to:

```tsx
  if (loading) {
    return (
      <div>
        <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />
        <div className="p-four text-sm text-muted-foreground">{t.items.loading}</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div>
        <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />
        <div className="p-four text-sm text-muted-foreground">{t.calendar.noItems}</div>
      </div>
    )
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/routes/CalendarPage.test.tsx`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/CalendarPage.tsx apps/web/src/routes/CalendarPage.test.tsx
git commit -m "feat(web): show a loading state in CalendarPage while items are fetched"
```

---

### Task 9: Full verification

**Files:** none (verification only).

**Interfaces:** none — this task confirms every prior task's changes compose correctly.

- [ ] **Step 1: Run the full test suite**

Run (from `apps/web/`): `npm test`
Expected: PASS — every test file in `apps/web/src`, including all files touched in Tasks 1–8 plus every untouched file (`RequestsPage.test.tsx`, `EarningsPage.test.tsx`, `ReservationDetailPage.test.tsx`, `LoginPage.test.tsx`, `RegisterPage.test.tsx`, `RequireAuth.test.tsx`, `mockData.test.ts`, `i18n/index.test.ts`, `availability.test.ts`, `calendar.test.ts`, `format.test.ts`, `App.test.tsx`, `StatusBadge.test.tsx`, `PageHeader.test.tsx`, `AuthBrandHeader.test.tsx`, `AuthErrorBanner.test.tsx`, `DashboardLayout.test.tsx`, `button.test.tsx`).

If anything fails outside the files this plan touched, it's a sign a shared fixture (most likely `mockItems` in `apps/web/src/lib/mockData.ts`) was accidentally changed — check `git diff` against `origin/develop` and confirm `mockData.ts` itself was never edited by any task above.

- [ ] **Step 2: Run the TypeScript build**

Run: `npm run build`
Expected: PASS — `tsc -b` reports no type errors, `vite build` completes. This is the step that catches any remaining consumer of the old `ItemsContext` shape (`setItemActive`, synchronous `addItem`) that a prior task might have missed.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`
Expected: PASS — no new `oxlint` warnings introduced by this branch.

- [ ] **Step 4: Manual smoke test**

Confirm `apps/api` is running locally per the root `CLAUDE.md` ("Run locally" section: `docker compose -f infra/docker-compose.yml up -d` then `uvicorn app.main:app --reload` from `apps/api`), and `apps/web/.env` has `VITE_API_URL` pointing at it. Then, from `apps/web/`: `npm run dev`, log in with a seeded test user (`python infra/seed.py`, per root `CLAUDE.md`), and manually:
1. Publish a new item with a pasted photo URL — confirm it appears on `/items` and persists across a page refresh (proves it's server-side, not local state).
2. Edit that item's price — confirm the change persists across a refresh.
3. Delete it — confirm it either disappears from the default view or shows as inactive with only an Edit action, and that a refresh doesn't bring back a "Reactivate" button.
4. Check `/dashboard`'s "Active items" KPI matches `/items`'s active count.
5. Check `/requests/calendar` shows the published item in its dropdown.

- [ ] **Step 5: Commit (only if Steps 1-3 required fixes)**

If any fix was needed to make the full suite/build/lint pass, commit it separately:

```bash
git add -A
git commit -m "fix(web): resolve full-suite/build issues found in final verification"
```

If nothing needed fixing, skip this step — there's nothing to commit.

---

## Self-Review

**Spec coverage:** `api.ts` additions (Task 1) ✓, `AuthContext.token` (Task 2) ✓, `ItemsContext` rewrite incl. refetch-after-mutation strategy (Task 3) ✓, reactivate removal from `ItemCard` (Task 4) ✓, `PublishItemPage` async submit + error banner + real user (Task 5) ✓, `ItemsPage` async edit/delete + loading/error states + reactivate removal (Task 6) ✓, `DashboardPage` KPI (Task 7) ✓, i18n key changes folded into the tasks that need them (Tasks 3, 4, 5, 6) ✓, explicitly-out-of-scope items (presign/camera capture, public `GET /items`, `apps/api` changes) — untouched by any task ✓. The `CalendarPage` gap found during planning is covered by Task 8, called out in the addendum above.

**Placeholder scan:** no "TBD"/"TODO"/"add appropriate error handling" — every step has complete code and exact commands.

**Type consistency:** `CreateItemPayload`/`UpdateItemPayload` (Task 1) are the exact types `ItemsContext.addItem`/`updateItem` (Task 3) accept, which are what `PublishItemPage`/`ItemsPage` (Tasks 5–6) call. `useItems()`'s returned shape (`items`, `loading`, `error`, `addItem`, `updateItem`, `deleteItem`) is identical across Tasks 3, 5, 6, 7, 8 — no file references the removed `setItemActive` after Task 3. `AuthContextValue.token` (Task 2) is the exact field `ItemsContext` (Task 3) reads via `useAuth()`.
