import { act, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getErrorMessage } from './api'
import { AuthProvider, useAuth } from './AuthContext'
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
      <button onClick={logout}>logout</button>
    </div>
  )
}

function MutationOutcomeProbe({ action }: { action: 'add' | 'update' | 'delete' }) {
  const { addItem, updateItem, deleteItem } = useItems()
  const [outcome, setOutcome] = useState<'idle' | 'resolved' | 'rejected'>('idle')
  const [message, setMessage] = useState('')

  function run() {
    const promise =
      action === 'add'
        ? addItem({
            name: 'New Item',
            description: 'desc',
            category: 'tools',
            price_per_day: 500,
            photo_url: 'https://example.com/new.jpg',
          })
        : action === 'update'
          ? updateItem('i1', { name: 'Renamed' })
          : deleteItem('i1')

    promise
      .then(() => setOutcome('resolved'))
      .catch((err) => {
        setOutcome('rejected')
        setMessage(getErrorMessage(err, 'FALLBACK_MESSAGE'))
      })
  }

  return (
    <div>
      <span data-testid="outcome">{outcome}</span>
      <span data-testid="message">{message}</span>
      <button onClick={run}>run</button>
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

  it('discards a stale in-flight response if the token changes before it resolves', async () => {
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

    // Log out while the GET /users/me/items request for the old token is
    // still in flight — this changes `token` and re-runs the mount effect.
    act(() => screen.getByText('logout').click())

    // The logout should immediately clear items (correct, current state).
    expect(screen.getByTestId('count')).toHaveTextContent('0')

    // Now let the stale, in-flight response for the OLD token resolve.
    // It must NOT clobber the post-logout state with the old user's items.
    await act(async () => {
      resolveItems(jsonResponse([ITEM], 200))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('count')).toHaveTextContent('0')
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

  it('discards a stale in-flight response from a mutation-triggered refetch if the token changes before it resolves', async () => {
    let resolveMutationRefetch: (r: Response) => void = () => {}
    const mutationRefetchPromise = new Promise<Response>((resolve) => {
      resolveMutationRefetch = resolve
    })
    let itemsCallCount = 0
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.endsWith('/items/i1')) return Promise.resolve(jsonResponse({ ...ITEM, is_active: false }, 200))
      if (url.endsWith('/users/me/items')) {
        itemsCallCount += 1
        if (itemsCallCount === 1) return Promise.resolve(jsonResponse([ITEM], 200))
        return mutationRefetchPromise
      }
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

    // Trigger deleteItem: its own DELETE call resolves immediately, then it
    // kicks off a refetch() whose GET /users/me/items we keep hanging.
    act(() => screen.getByText('delete').click())
    await waitFor(() => expect(itemsCallCount).toBe(2))

    // Log out while the mutation's own refetch is still in flight for the
    // OLD token — this must clear the list for the new (null) token.
    act(() => screen.getByText('logout').click())
    expect(screen.getByTestId('count')).toHaveTextContent('0')

    // Now let the stale mutation-refetch response for the OLD token resolve.
    // It must NOT clobber the post-logout state with the old user's items.
    await act(async () => {
      resolveMutationRefetch(jsonResponse([ITEM], 200))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('rejects updateItem when its post-mutation refetch fails, even though the PATCH itself succeeded', async () => {
    let itemsCallCount = 0
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.endsWith('/items/i1')) return Promise.resolve(jsonResponse({ ...ITEM, name: 'Renamed' }, 200))
      if (url.endsWith('/users/me/items')) {
        itemsCallCount += 1
        if (itemsCallCount === 1) return Promise.resolve(jsonResponse([ITEM], 200))
        return Promise.resolve(jsonResponse({ error: { code: 'SERVER_ERROR', message: 'boom' } }, 500))
      }
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    localStorage.setItem('rentatodo_token', 'tok123')
    render(
      <AuthProvider>
        <ItemsProvider>
          <MutationOutcomeProbe action="update" />
        </ItemsProvider>
      </AuthProvider>,
    )

    await waitFor(() => expect(itemsCallCount).toBe(1))

    act(() => screen.getByText('run').click())

    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('rejected'))
  })

  it('throws an ApiError (not a generic Error) when a mutation is attempted without a token, so getErrorMessage surfaces the real message', async () => {
    render(
      <AuthProvider>
        <ItemsProvider>
          <MutationOutcomeProbe action="add" />
        </ItemsProvider>
      </AuthProvider>,
    )

    act(() => screen.getByText('run').click())

    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('rejected'))
    expect(screen.getByTestId('message')).toHaveTextContent('Not authenticated')
  })

  it('throws when useItems is called outside a provider', () => {
    function Bare() {
      useItems()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useItems must be used within an ItemsProvider')
  })
})
