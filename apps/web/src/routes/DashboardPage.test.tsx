// apps/web/src/routes/DashboardPage.test.tsx
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { EarningsProvider } from '@/lib/EarningsContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { RESERVED_STATUSES } from '@/lib/availability'
import type { Reservation } from '@/lib/types'
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

const REQUESTED: Reservation = {
  id: 'r1',
  item_id: 'i1',
  item_name: 'Taladro',
  item_photo_url: 'https://example.com/p.jpg',
  renter_id: 'u2',
  renter_name: 'Jorge Salas',
  start_date: '2026-07-18',
  end_date: '2026-07-20',
  status: 'requested',
  deposit_amount: 2000,
  deposit_status: 'none',
  checkin_photo_url: null,
  checkout_photo_url: null,
  created_at: '2026-07-14T12:00:00Z',
  updated_at: '2026-07-14T12:00:00Z',
}
const DELIVERED: Reservation = { ...REQUESTED, id: 'r2', renter_id: 'u3', renter_name: 'Camila Ríos', status: 'delivered', deposit_status: 'held' }
const RETURNED: Reservation = { ...REQUESTED, id: 'r3', renter_id: 'u4', renter_name: 'Luz Fernández', status: 'returned', deposit_status: 'held' }
const CLOSED: Reservation = { ...REQUESTED, id: 'r4', renter_id: 'u5', renter_name: 'Sofía Guzmán', status: 'closed', deposit_status: 'released' }
const REJECTED: Reservation = { ...REQUESTED, id: 'r5', renter_id: 'u6', renter_name: 'Pablo Díaz', status: 'rejected', deposit_status: 'none' }

const RESERVATIONS: Reservation[] = [REQUESTED, DELIVERED, RETURNED, CLOSED, REJECTED]

// Lifetime total ($90.00) intentionally differs from the current-month total ($30.00) so
// tests can catch the KPI accidentally rendering total_earnings instead of the current bucket.
const EARNINGS = {
  total_earnings: 9000,
  by_item: [
    {
      item_id: 'i1',
      item_name: 'Taladro',
      total: 9000,
      rentals: [
        { start_date: '2026-06-01', end_date: '2026-06-03', amount: 6000 },
        { start_date: '2026-07-15', end_date: '2026-07-17', amount: 3000 },
      ],
    },
  ],
}

function mockFetchOk(overrides: { items?: unknown[]; reservations?: unknown[]; profile?: unknown; earnings?: unknown } = {}) {
  const items = overrides.items ?? []
  const reservations = overrides.reservations ?? RESERVATIONS
  const profile = overrides.profile ?? PROFILE
  const earnings = overrides.earnings ?? EARNINGS
  mockFetchRoutes({
    '/users/me': [() => jsonResponse(profile, 200)],
    '/users/me/items': [() => jsonResponse(items, 200)],
    '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations, page: 1, limit: 50, total: reservations.length }, 200)],
    '/users/me/earnings': [() => jsonResponse(earnings, 200)],
  })
}

function renderDashboard() {
  render(
    <AuthProvider>
      <ItemsProvider>
        <RequestsProvider>
          <EarningsProvider>
            <MemoryRouter>
              <DashboardPage />
            </MemoryRouter>
          </EarningsProvider>
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
    vi.useRealTimers()
  })

  it('renders the Active items KPI from fetched items, not a static mock array', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchOk({ items: ITEMS })
    renderDashboard()
    const pending = RESERVATIONS.filter((r) => r.status === 'requested').length

    const activeItemsCard = screen.getByText('Active items').closest('div')!
    await waitFor(() => expect(within(activeItemsCard).getByText('2')).toBeInTheDocument())

    const pendingCard = screen.getByText('Pending requests').closest('div')!
    await waitFor(() => expect(within(pendingCard).getByText(String(pending))).toBeInTheDocument())
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

  it('shows the current-month earnings on the "Earned this month" KPI, not the lifetime total', async () => {
    // Freeze to July 2026 so deriveByMonth's 6-month window ends in July and the
    // July rental (amount: 3000) is the last bucket — not August (which has no rentals).
    vi.useFakeTimers({ now: new Date('2026-07-15T12:00:00Z'), toFake: ['Date'] })
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchOk()
    renderDashboard()
    const earnedCard = screen.getByText('Earned this month').closest('div')!
    await waitFor(() => expect(within(earnedCard).getByText('$30.00')).toBeInTheDocument())
    expect(within(earnedCard).queryByText('$90.00')).not.toBeInTheDocument()
  })

  it('shows at most 2 pending requests and lets you approve one', async () => {
    const user = userEvent.setup()
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: RESERVATIONS.length }, 200),
        () =>
          jsonResponse(
            {
              reservations: [{ ...REQUESTED, status: 'approved', deposit_status: 'held' }, DELIVERED, RETURNED, CLOSED, REJECTED],
              page: 1,
              limit: 50,
              total: RESERVATIONS.length,
            },
            200,
          ),
      ],
      '/reservations/r1/approve': [() => jsonResponse({ ...REQUESTED, status: 'approved', deposit_status: 'held' }, 200)],
      '/users/me/earnings': [() => jsonResponse({ total_earnings: 0, by_item: [] }, 200)],
    })
    renderDashboard()
    const row = await screen.findByText(new RegExp(REQUESTED.renter_name))
    await user.click(within(row.closest('li')!).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.queryByText(new RegExp(REQUESTED.renter_name))).not.toBeInTheDocument())
  })

  it("disables the acting row's Approve and Reject buttons while the approve request is in flight, and clears them once it resolves", async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    let resolveApprove: (r: Response) => void = () => {}
    const approvePromise = new Promise<Response>((resolve) => {
      resolveApprove = resolve
    })
    let requestsCallCount = 0
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.endsWith('/users/me/items')) return Promise.resolve(jsonResponse([], 200))
      if (url.endsWith('/reservations/r1/approve')) return approvePromise
      if (url.includes('/users/me/requests')) {
        requestsCallCount += 1
        if (requestsCallCount === 1) {
          return Promise.resolve(jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: RESERVATIONS.length }, 200))
        }
        return Promise.resolve(
          jsonResponse(
            {
              reservations: [{ ...REQUESTED, status: 'approved', deposit_status: 'held' }, DELIVERED, RETURNED, CLOSED, REJECTED],
              page: 1,
              limit: 50,
              total: RESERVATIONS.length,
            },
            200,
          ),
        )
      }
      if (url.endsWith('/users/me/earnings')) return Promise.resolve(jsonResponse({ total_earnings: 0, by_item: [] }, 200))
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    const user = userEvent.setup()
    renderDashboard()
    const row = await screen.findByText(new RegExp(REQUESTED.renter_name))
    const li = row.closest('li')!
    const approveButton = within(li).getByRole('button', { name: 'Approve' })
    const rejectButton = within(li).getByRole('button', { name: 'Reject' })

    expect(approveButton).not.toBeDisabled()
    expect(rejectButton).not.toBeDisabled()

    await user.click(approveButton)

    // Approve call is still pending: assert both buttons are disabled in a single waitFor,
    // right after the click and before the follow-up refetch has any chance to
    // unmount/remount this row (which would make later reads of these handles stale).
    await waitFor(() => {
      expect(approveButton).toBeDisabled()
      expect(rejectButton).toBeDisabled()
    })

    await act(async () => {
      resolveApprove(jsonResponse({ ...REQUESTED, status: 'approved', deposit_status: 'held' }, 200))
    })

    // Once the approve call and the follow-up refetch resolve, the now-approved
    // reservation leaves the recent-pending list entirely.
    await waitFor(() => expect(screen.queryByText(new RegExp(REQUESTED.renter_name))).not.toBeInTheDocument())
  })

  it('renders the page header with the title', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it("shows the authenticated user's first name in the welcome message, not the mock user", async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchOk({ profile: { id: 'u1', name: 'Ana Torres', email: 'ana@example.com', created_at: '2026-01-01T00:00:00Z' }, reservations: [] })

    renderDashboard()

    await waitFor(() => expect(screen.getByText('Welcome back, Ana')).toBeInTheDocument())
  })

  it('shows the items-fetch error without hiding the rest of the dashboard', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Server exploded' } }, 500)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [], page: 1, limit: 50, total: 0 }, 200)],
      '/users/me/earnings': [() => jsonResponse({ total_earnings: 0, by_item: [] }, 200)],
    })
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Server exploded')).toBeInTheDocument())
    const activeItemsCard = screen.getByText('Active items').closest('div')!
    expect(within(activeItemsCard).getByText('0')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it('shows the requests-fetch error without hiding the rest of the dashboard', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Requests server exploded' } }, 500),
      ],
      '/users/me/earnings': [() => jsonResponse({ total_earnings: 0, by_item: [] }, 200)],
    })
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Requests server exploded')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it('"Active reservations" KPI matches RequestsPage\'s Active tab count, including returned', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchOk()
    renderDashboard()
    const expectedActive = RESERVATIONS.filter((r) => RESERVED_STATUSES.includes(r.status)).length
    const activeCard = screen.getByText('Active reservations').closest('div')!
    await waitFor(() => expect(within(activeCard).getByText(String(expectedActive))).toBeInTheDocument())
  })

  it('approving a request on the Dashboard is reflected on the Requests page', async () => {
    const user = userEvent.setup()
    localStorage.setItem('rentatodo_token', 'tok123')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: RESERVATIONS.length }, 200),
        () =>
          jsonResponse(
            {
              reservations: [{ ...REQUESTED, status: 'approved', deposit_status: 'held' }, DELIVERED, RETURNED, CLOSED, REJECTED],
              page: 1,
              limit: 50,
              total: RESERVATIONS.length,
            },
            200,
          ),
      ],
      '/reservations/r1/approve': [() => jsonResponse({ ...REQUESTED, status: 'approved', deposit_status: 'held' }, 200)],
      '/users/me/earnings': [() => jsonResponse({ total_earnings: 0, by_item: [] }, 200)],
    })
    render(
      <AuthProvider>
        <ItemsProvider>
          <RequestsProvider>
            <EarningsProvider>
              <MemoryRouter>
                <DashboardPage />
                <RequestsPage />
              </MemoryRouter>
            </EarningsProvider>
          </RequestsProvider>
        </ItemsProvider>
      </AuthProvider>,
    )
    const dashboardRow = (await screen.findAllByText(new RegExp(REQUESTED.renter_name)))[0].closest('li')!
    await user.click(within(dashboardRow).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.queryByText(new RegExp(REQUESTED.renter_name))).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^Active/ }))
    await waitFor(() => expect(screen.getByText(new RegExp(REQUESTED.renter_name))).toBeInTheDocument())
  })
})
