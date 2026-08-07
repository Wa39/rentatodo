import { act, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getErrorMessage } from './api'
import { AuthProvider, useAuth } from './AuthContext'
import { RequestsProvider, useRequests } from './RequestsContext'

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

const RESERVATION = {
  id: 'r1',
  item_id: 'i1',
  item_name: 'Taladro Bosch Professional',
  item_photo_url: 'https://storage.example.com/photos/taladro.jpg',
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

function Probe() {
  const { requests, loading, error, hasMore, loadingMore, loadMore, approveRequest, rejectRequest, closeRequest } = useRequests()
  const { logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'idle'}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="count">{requests.length}</span>
      <span data-testid="has-more">{hasMore ? 'yes' : 'no'}</span>
      <span data-testid="loading-more">{loadingMore ? 'loading' : 'idle'}</span>
      <ul>
        {requests.map((r) => (
          <li key={r.id}>
            {r.renter_name} · {r.status}
          </li>
        ))}
      </ul>
      <button onClick={() => approveRequest('r1').catch(() => {})}>approve</button>
      <button onClick={() => rejectRequest('r1').catch(() => {})}>reject</button>
      <button onClick={() => closeRequest('r1').catch(() => {})}>close</button>
      <button onClick={() => loadMore().catch(() => {})}>load more</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

function MutationOutcomeProbe({ action }: { action: 'approve' | 'reject' }) {
  const { approveRequest, rejectRequest } = useRequests()
  const [outcome, setOutcome] = useState<'idle' | 'resolved' | 'rejected'>('idle')
  const [message, setMessage] = useState('')

  function run() {
    const promise = action === 'approve' ? approveRequest('r1') : rejectRequest('r1')
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
      <RequestsProvider>
        <Probe />
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('RequestsContext', () => {
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
        <RequestsProvider>
          <Probe />
        </RequestsProvider>
      </AuthProvider>,
    )
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches GET /users/me/requests on mount and unwraps the paginated envelope', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    expect(screen.getByText('Jorge Salas · requested')).toBeInTheDocument()
  })

  it('sets loading while the initial fetch is in flight', async () => {
    let resolveRequests: (r: Response) => void = () => {}
    const requestsPromise = new Promise<Response>((resolve) => {
      resolveRequests = resolve
    })
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.includes('/users/me/requests')) return requestsPromise
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    renderWithToken()

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')
    act(() => resolveRequests(jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)))
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('idle'))
  })

  it('discards a stale in-flight response if the token changes before it resolves', async () => {
    let resolveRequests: (r: Response) => void = () => {}
    const requestsPromise = new Promise<Response>((resolve) => {
      resolveRequests = resolve
    })
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.includes('/users/me/requests')) return requestsPromise
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    renderWithToken()

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')

    act(() => screen.getByText('logout').click())
    expect(screen.getByTestId('count')).toHaveTextContent('0')

    await act(async () => {
      resolveRequests(jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('sets an error message when the initial fetch fails, without throwing', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401),
      ],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Not authenticated'))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('approveRequest PATCHes /approve then refetches the list', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200),
        () =>
          jsonResponse(
            { reservations: [{ ...RESERVATION, status: 'approved', deposit_status: 'held' }], page: 1, limit: 50, total: 1 },
            200,
          ),
      ],
      '/reservations/r1/approve': [() => jsonResponse({ ...RESERVATION, status: 'approved', deposit_status: 'held' }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

    act(() => screen.getByText('approve').click())

    await waitFor(() => expect(screen.getByText('Jorge Salas · approved')).toBeInTheDocument())
  })

  it('rejectRequest PATCHes /reject then refetches the list', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200),
        () => jsonResponse({ reservations: [{ ...RESERVATION, status: 'rejected' }], page: 1, limit: 50, total: 1 }, 200),
      ],
      '/reservations/r1/reject': [() => jsonResponse({ ...RESERVATION, status: 'rejected' }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

    act(() => screen.getByText('reject').click())

    await waitFor(() => expect(screen.getByText('Jorge Salas · rejected')).toBeInTheDocument())
  })

  it('closeRequest PATCHes /close then refetches the list', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200),
        () => jsonResponse({ reservations: [{ ...RESERVATION, status: 'closed' }], page: 1, limit: 50, total: 1 }, 200),
      ],
      '/reservations/r1/close': [() => jsonResponse({ ...RESERVATION, status: 'closed' }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

    act(() => screen.getByText('close').click())

    await waitFor(() => expect(screen.getByText('Jorge Salas · closed')).toBeInTheDocument())
  })

  it('reports hasMore when the first page does not cover the full total', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 2 }, 200)],
    })

    renderWithToken()

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    expect(screen.getByTestId('has-more')).toHaveTextContent('yes')
  })

  it('loadMore fetches the next page, appends it, and clears hasMore once the total is covered', async () => {
    const page2Reservation = { ...RESERVATION, id: 'r2', renter_name: 'Camila Ríos' }
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 2 }, 200)],
      '/users/me/requests?page=2&limit=50': [() => jsonResponse({ reservations: [page2Reservation], page: 2, limit: 50, total: 2 }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('has-more')).toHaveTextContent('yes'))

    act(() => screen.getByText('load more').click())

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'))
    expect(screen.getByText('Camila Ríos · requested')).toBeInTheDocument()
    expect(screen.getByTestId('has-more')).toHaveTextContent('no')
  })

  it('sets loadingMore while a loadMore fetch is in flight, without touching loading', async () => {
    let resolvePage2: (r: Response) => void = () => {}
    const page2Promise = new Promise<Response>((resolve) => {
      resolvePage2 = resolve
    })
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 2 }, 200)],
    })
    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('has-more')).toHaveTextContent('yes'))

    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('page=2')) return page2Promise
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    act(() => screen.getByText('load more').click())

    await waitFor(() => expect(screen.getByTestId('loading-more')).toHaveTextContent('loading'))
    expect(screen.getByTestId('loading')).toHaveTextContent('idle')

    await act(async () => {
      resolvePage2(jsonResponse({ reservations: [{ ...RESERVATION, id: 'r2' }], page: 2, limit: 50, total: 2 }, 200))
    })

    await waitFor(() => expect(screen.getByTestId('loading-more')).toHaveTextContent('idle'))
  })

  it('a mutation refetch re-fetches every page already loaded, instead of collapsing back to page 1', async () => {
    const page2Reservation = { ...RESERVATION, id: 'r2', renter_name: 'Camila Ríos' }
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 2 }, 200),
        () => jsonResponse({ reservations: [{ ...RESERVATION, status: 'approved', deposit_status: 'held' }], page: 1, limit: 50, total: 2 }, 200),
      ],
      '/users/me/requests?page=2&limit=50': [
        () => jsonResponse({ reservations: [page2Reservation], page: 2, limit: 50, total: 2 }, 200),
        () => jsonResponse({ reservations: [page2Reservation], page: 2, limit: 50, total: 2 }, 200),
      ],
      '/reservations/r1/approve': [() => jsonResponse({ ...RESERVATION, status: 'approved', deposit_status: 'held' }, 200)],
    })

    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('has-more')).toHaveTextContent('yes'))
    act(() => screen.getByText('load more').click())
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'))

    act(() => screen.getByText('approve').click())

    await waitFor(() => expect(screen.getByText('Jorge Salas · approved')).toBeInTheDocument())
    // The page-2 row must still be there — a refetch that only re-fetched
    // page 1 would have replaced the list and dropped it.
    expect(screen.getByText('Camila Ríos · requested')).toBeInTheDocument()
    expect(screen.getByTestId('count')).toHaveTextContent('2')
  })

  it('resets loadingMore on logout even if the loadMore fetch never resolves', async () => {
    let resolvePage2: (r: Response) => void = () => {}
    const page2Promise = new Promise<Response>((resolve) => {
      resolvePage2 = resolve
    })
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 2 }, 200)],
    })
    renderWithToken()
    await waitFor(() => expect(screen.getByTestId('has-more')).toHaveTextContent('yes'))

    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('page=2')) return page2Promise
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    act(() => screen.getByText('load more').click())
    await waitFor(() => expect(screen.getByTestId('loading-more')).toHaveTextContent('loading'))

    act(() => screen.getByText('logout').click())

    expect(screen.getByTestId('loading-more')).toHaveTextContent('idle')
    expect(screen.getByTestId('count')).toHaveTextContent('0')

    // The abandoned page-2 response arriving late must not resurrect state.
    await act(async () => {
      resolvePage2(jsonResponse({ reservations: [{ ...RESERVATION, id: 'r2' }], page: 2, limit: 50, total: 2 }, 200))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByTestId('loading-more')).toHaveTextContent('idle')
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('throws an ApiError (not a generic Error) when a mutation is attempted without a token', async () => {
    render(
      <AuthProvider>
        <RequestsProvider>
          <MutationOutcomeProbe action="approve" />
        </RequestsProvider>
      </AuthProvider>,
    )

    act(() => screen.getByText('run').click())

    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('rejected'))
    expect(screen.getByTestId('message')).toHaveTextContent('Not authenticated')
  })

  it('throws when useRequests is called outside a provider', () => {
    function Bare() {
      useRequests()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useRequests must be used within a RequestsProvider')
  })
})
