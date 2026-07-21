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

  it('shows the items-fetch error without hiding the rest of the dashboard', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Server exploded' } }, 500)],
    })
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Server exploded')).toBeInTheDocument())
    const activeItemsCard = screen.getByText('Active items').closest('div')!
    expect(within(activeItemsCard).getByText('0')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
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
