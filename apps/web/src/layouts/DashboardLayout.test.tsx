import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { DashboardLayout } from './DashboardLayout'

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

const PENDING_RESERVATION = {
  id: 'r1',
  item_id: 'i1',
  item_name: 'Taladro Bosch Professional',
  item_photo_url: 'https://example.com/p.jpg',
  renter_id: 'u2',
  renter_name: 'Jorge Salas',
  start_date: '2026-07-18',
  end_date: '2026-07-20',
  status: 'requested',
  deposit_amount: 2000,
  deposit_status: 'none',
  created_at: '2026-07-14T12:00:00Z',
  updated_at: '2026-07-14T12:00:00Z',
}

function renderLayout() {
  render(
    <AuthProvider>
      <RequestsProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<div>Home content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('renders nav links for every top-level dashboard section, including Calendar', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'My items' })).toHaveAttribute('href', '/items')
    expect(screen.getByRole('link', { name: 'Publish item' })).toHaveAttribute('href', '/items/publish')
    expect(screen.getByRole('link', { name: /^Requests/ })).toHaveAttribute('href', '/requests')
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute('href', '/requests/calendar')
    expect(screen.getByRole('link', { name: 'Earnings' })).toHaveAttribute('href', '/earnings')
    expect(screen.getByText('Home content')).toBeInTheDocument()
  })

  it('shows a centered pending-request count badge on the Requests link', async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    vi.spyOn(global, 'fetch')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [PENDING_RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
    })
    renderLayout()
    const requestsLink = screen.getByRole('link', { name: /^Requests/ })
    await waitFor(() => expect(requestsLink).toHaveTextContent(/\d+/))
    const badge = requestsLink.querySelector('span')!
    expect(badge).toHaveClass('h-6', 'w-6', 'flex', 'items-center', 'justify-center')
  })

  it('shows the earned-this-month widget above the user footer', () => {
    renderLayout()
    const currentMonth = mockEarnings.by_month[mockEarnings.by_month.length - 1]
    expect(screen.getByText(formatCentavos(currentMonth.total))).toBeInTheDocument()
  })

  it('shows a down arrow when this month earned less than last month', async () => {
    vi.resetModules()
    vi.doMock('@/lib/mockData', async () => {
      const actual = await vi.importActual<typeof import('@/lib/mockData')>('@/lib/mockData')
      return {
        ...actual,
        mockEarnings: { ...actual.mockEarnings, by_month: [{ month: 'Jun', total: 2000 }, { month: 'Jul', total: 1000 }] },
      }
    })
    const authModule = await import('@/lib/AuthContext')
    const requestsModule = await import('@/lib/RequestsContext')
    const { DashboardLayout: PatchedLayout } = await import('./DashboardLayout')
    render(
      <authModule.AuthProvider>
        <requestsModule.RequestsProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route element={<PatchedLayout />}>
                <Route path="/dashboard" element={<div>Home content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </requestsModule.RequestsProvider>
      </authModule.AuthProvider>,
    )
    expect(screen.getByText(/↓ 50%/)).toBeInTheDocument()
    vi.doUnmock('@/lib/mockData')
  })

  it("shows the authenticated user's real name and initials, not the mock user", async () => {
    localStorage.setItem('rentatodo_token', 'tok123')
    vi.spyOn(global, 'fetch')
    mockFetchRoutes({
      '/users/me': [() => jsonResponse({ id: 'u1', name: 'Ana Torres', email: 'ana@example.com', created_at: '2026-01-01T00:00:00Z' }, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [], page: 1, limit: 50, total: 0 }, 200)],
    })

    renderLayout()

    await waitFor(() => expect(screen.getByText('Ana Torres')).toBeInTheDocument())
    expect(screen.getByText('AT')).toBeInTheDocument()
  })
})
