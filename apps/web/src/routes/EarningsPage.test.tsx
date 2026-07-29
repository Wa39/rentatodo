import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCentavos } from '@/lib/format'
import { AuthProvider } from '@/lib/AuthContext'
import { EarningsProvider } from '@/lib/EarningsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { EarningsPage } from './EarningsPage'

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

const EARNINGS_PAYLOAD = {
  total_earnings: 7000,
  by_item: [
    {
      item_id: 'i1',
      item_name: 'Taladro Bosch Professional',
      total: 3000,
      rentals: [{ start_date: '2026-07-01', end_date: '2026-07-03', amount: 3000 }],
    },
    {
      item_id: 'i2',
      item_name: 'Carpa Camping 4 personas',
      total: 4000,
      rentals: [{ start_date: '2026-06-10', end_date: '2026-06-12', amount: 4000 }],
    },
  ],
}

function renderPage() {
  return render(
    <AuthProvider>
      <RequestsProvider>
        <EarningsProvider>
          <EarningsPage />
        </EarningsProvider>
      </RequestsProvider>
    </AuthProvider>,
  )
}

function mockFetchOk(earningsPayload: unknown = EARNINGS_PAYLOAD) {
  mockFetchRoutes({
    '/users/me': [() => jsonResponse(PROFILE, 200)],
    '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [], page: 1, limit: 50, total: 0 }, 200)],
    '/users/me/earnings': [() => jsonResponse(earningsPayload, 200)],
  })
}

describe('EarningsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('rentatodo_token', 'tok123')
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the total-earned KPI from the real /users/me/earnings response', async () => {
    mockFetchOk()
    renderPage()
    await waitFor(() => expect(screen.getByText(formatCentavos(EARNINGS_PAYLOAD.total_earnings))).toBeInTheDocument())
  })

  it("renders the 'This month' KPI without NaN/Infinity, and 6 bars in the by-month chart", async () => {
    mockFetchOk()
    renderPage()
    await waitFor(() => expect(screen.getAllByTestId('earnings-month-bar')).toHaveLength(6))
    const thisMonthCard = screen.getByText('This month').closest('div')!
    expect(within(thisMonthCard).getByText((content) => content.startsWith('$'))).toBeInTheDocument()
  })

  it('selects the first item by default and updates the breakdown when another item is clicked', async () => {
    const user = userEvent.setup()
    mockFetchOk()
    renderPage()
    const first = EARNINGS_PAYLOAD.by_item[0]
    const second = EARNINGS_PAYLOAD.by_item[1]

    await waitFor(() => expect(screen.getByText(first.item_name, { selector: 'h2' })).toBeInTheDocument())
    const firstPanel = screen.getByText(first.item_name, { selector: 'h2' }).closest('div')!
    expect(within(firstPanel).getByText(`${first.rentals[0].start_date} - ${first.rentals[0].end_date}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: new RegExp(second.item_name) }))
    expect(screen.getByText(second.item_name, { selector: 'h2' })).toBeInTheDocument()
  })

  it('does not render NaN/Infinity bar heights when earnings data is empty', async () => {
    mockFetchOk({ total_earnings: 0, by_item: [] })
    expect(() => renderPage()).not.toThrow()
    await waitFor(() => expect(screen.getAllByTestId('earnings-month-bar')).toHaveLength(6))
  })

  it('shows the earnings-fetch error state', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [], page: 1, limit: 50, total: 0 }, 200)],
      '/users/me/earnings': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Earnings server exploded' } }, 500)],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Earnings server exploded')).toBeInTheDocument())
  })
})
