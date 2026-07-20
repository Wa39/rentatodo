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
