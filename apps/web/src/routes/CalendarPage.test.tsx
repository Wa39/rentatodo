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

  it('shows the fetch error instead of the misleading empty-state message when items fail to load', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Server exploded' } }, 500)],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Server exploded')).toBeInTheDocument())
    expect(screen.queryByText("You don't have any items yet. Publish one to see its calendar.")).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
