import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { EarningsProvider, useEarnings } from './EarningsContext'

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

function Probe() {
  const { earnings, loading, error } = useEarnings()
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'idle'}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="total">{earnings.total_earnings}</span>
      <span data-testid="by-item-count">{earnings.by_item.length}</span>
      <span data-testid="by-month-count">{earnings.by_month.length}</span>
    </div>
  )
}

function renderWithToken() {
  localStorage.setItem('rentatodo_token', 'tok123')
  return render(
    <AuthProvider>
      <EarningsProvider>
        <Probe />
      </EarningsProvider>
    </AuthProvider>,
  )
}

describe('EarningsContext', () => {
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
        <EarningsProvider>
          <Probe />
        </EarningsProvider>
      </AuthProvider>,
    )
    expect(screen.getByTestId('total')).toHaveTextContent('0')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches GET /users/me/earnings on mount and derives a 6-entry by_month', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/earnings': [
        () =>
          jsonResponse(
            {
              total_earnings: 7000,
              by_item: [
                {
                  item_id: 'i1',
                  item_name: 'Taladro',
                  total: 7000,
                  rentals: [{ start_date: '2026-07-01', end_date: '2026-07-03', amount: 7000 }],
                },
              ],
            },
            200,
          ),
      ],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('7000'))
    expect(screen.getByTestId('by-item-count')).toHaveTextContent('1')
    expect(screen.getByTestId('by-month-count')).toHaveTextContent('6')
  })

  it('sets an error message when the fetch fails, without throwing', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/earnings': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Earnings server exploded' } }, 500)],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Earnings server exploded'))
    expect(screen.getByTestId('total')).toHaveTextContent('0')
  })

  it('throws when useEarnings is called outside a provider', () => {
    function Bare() {
      useEarnings()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useEarnings must be used within an EarningsProvider')
  })
})
