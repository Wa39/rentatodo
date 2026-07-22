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

  it('keeps the edit dialog open if the user tries to close it while the save is still in flight', async () => {
    let resolvePatch: (value: Response) => void = () => {}
    const pendingPatch = new Promise<Response>((resolve) => {
      resolvePatch = resolve
    })
    const meItemsQueue = [() => jsonResponse(ITEMS, 200), () => jsonResponse(ITEMS, 200)]
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.endsWith('/users/me/items')) {
        const next = meItemsQueue.shift()
        if (next) return Promise.resolve(next())
        throw new Error('Unexpected extra /users/me/items call')
      }
      if (url.endsWith('/items/i1')) return pendingPatch
      throw new Error(`Unhandled fetch call: ${url}`)
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    const item = ITEMS[0]
    await waitFor(() => expect(screen.getByText(item.name)).toBeInTheDocument())
    const card = screen.getByTestId(`item-card-${item.id}`)
    await user.click(within(card).getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Name')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save item' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument())

    await user.keyboard('{Escape}')
    expect(screen.getByLabelText('Name')).toBeInTheDocument()

    resolvePatch(jsonResponse(ITEMS[0], 200))
    await waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())
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
