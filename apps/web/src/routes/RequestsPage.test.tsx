import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { RequestsProvider } from '@/lib/RequestsContext'
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

const REQUESTED = {
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
const DELIVERED = { ...REQUESTED, id: 'r2', renter_id: 'u3', renter_name: 'Camila Ríos', status: 'delivered', deposit_status: 'held' }
const CLOSED = { ...REQUESTED, id: 'r3', renter_id: 'u4', renter_name: 'Sofía Guzmán', status: 'closed', deposit_status: 'released' }

const RESERVATIONS = [REQUESTED, DELIVERED, CLOSED]

function renderPage() {
  localStorage.setItem('rentatodo_token', 'tok123')
  render(
    <AuthProvider>
      <RequestsProvider>
        <MemoryRouter initialEntries={['/requests']}>
          <Routes>
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/reservations/:id" element={<div>Reservation detail</div>} />
          </Routes>
        </MemoryRouter>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('RequestsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the Pending tab by default with only requested reservations', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200)],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText(new RegExp(REQUESTED.renter_name))).toBeInTheDocument())
    expect(screen.queryByText(new RegExp(DELIVERED.renter_name))).not.toBeInTheDocument()
  })

  it('switches tabs and shows the right reservations for each bucket', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200)],
    })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText(new RegExp(REQUESTED.renter_name))).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /History/ }))
    expect(screen.getByText(new RegExp(CLOSED.renter_name))).toBeInTheDocument()
  })

  it('filters the visible tab by renter name', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200)],
    })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText(new RegExp(REQUESTED.renter_name))).toBeInTheDocument())
    await user.type(screen.getByRole('textbox'), REQUESTED.renter_name)
    expect(screen.getByText(new RegExp(REQUESTED.renter_name))).toBeInTheDocument()
  })

  it('approves a pending request, removing it from the Pending tab', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200),
        () =>
          jsonResponse(
            { reservations: [{ ...REQUESTED, status: 'approved', deposit_status: 'held' }, DELIVERED, CLOSED], page: 1, limit: 50, total: 3 },
            200,
          ),
      ],
      '/reservations/r1/approve': [() => jsonResponse({ ...REQUESTED, status: 'approved', deposit_status: 'held' }, 200)],
    })
    const user = userEvent.setup()
    renderPage()
    const row = await screen.findByText(new RegExp(REQUESTED.renter_name))
    await user.click(within(row.closest('li')!).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.queryByText(new RegExp(REQUESTED.renter_name))).not.toBeInTheDocument())
  })

  it("disables the acting row's Approve and Reject buttons while the approve request is in flight, and clears them once it resolves", async () => {
    let resolveApprove: (r: Response) => void = () => {}
    const approvePromise = new Promise<Response>((resolve) => {
      resolveApprove = resolve
    })
    let resolveRefetch: (r: Response) => void = () => {}
    const refetchPromise = new Promise<Response>((resolve) => {
      resolveRefetch = resolve
    })
    let requestsCallCount = 0
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.endsWith('/reservations/r1/approve')) return approvePromise
      if (url.includes('/users/me/requests')) {
        requestsCallCount += 1
        if (requestsCallCount === 1) {
          return Promise.resolve(jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200))
        }
        return refetchPromise
      }
      throw new Error(`Unhandled fetch call: ${url}`)
    })

    const user = userEvent.setup()
    renderPage()
    const row = await screen.findByText(new RegExp(REQUESTED.renter_name))
    const li = row.closest('li')!
    const approveButton = within(li).getByRole('button', { name: 'Approve' })
    const rejectButton = within(li).getByRole('button', { name: 'Reject' })

    expect(approveButton).not.toBeDisabled()
    expect(rejectButton).not.toBeDisabled()

    await user.click(approveButton)

    // Approve call is still pending: the row's buttons must be disabled to prevent double-submit.
    await waitFor(() => expect(approveButton).toBeDisabled())
    expect(rejectButton).toBeDisabled()

    await act(async () => {
      resolveApprove(jsonResponse({ ...REQUESTED, status: 'approved', deposit_status: 'held' }, 200))
      await Promise.resolve()
      await Promise.resolve()
    })

    // approveRequest() awaits refetch() before pendingId is cleared, so the buttons must
    // stay disabled through the follow-up GET /users/me/requests too.
    expect(approveButton).toBeDisabled()
    expect(rejectButton).toBeDisabled()

    await act(async () => {
      resolveRefetch(
        jsonResponse(
          { reservations: [{ ...REQUESTED, status: 'approved', deposit_status: 'held' }, DELIVERED, CLOSED], page: 1, limit: 50, total: 3 },
          200,
        ),
      )
    })

    // Once both calls resolve, the now-approved reservation leaves the Pending tab entirely.
    await waitFor(() => expect(screen.queryByText(new RegExp(REQUESTED.renter_name))).not.toBeInTheDocument())
  })

  it('rejects a pending request, removing it from the Pending tab', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200),
        () => jsonResponse({ reservations: [{ ...REQUESTED, status: 'rejected' }, DELIVERED, CLOSED], page: 1, limit: 50, total: 3 }, 200),
      ],
      '/reservations/r1/reject': [() => jsonResponse({ ...REQUESTED, status: 'rejected' }, 200)],
    })
    const user = userEvent.setup()
    renderPage()
    const row = await screen.findByText(new RegExp(REQUESTED.renter_name))
    await user.click(within(row.closest('li')!).getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(screen.queryByText(new RegExp(REQUESTED.renter_name))).not.toBeInTheDocument())
  })

  it('links each row to its reservation detail page', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: RESERVATIONS, page: 1, limit: 50, total: 3 }, 200)],
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: new RegExp(REQUESTED.renter_name) })).toHaveAttribute(
        'href',
        `/reservations/${REQUESTED.id}`,
      ),
    )
  })

  it('shows a loading message while requests are still being fetched', () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(PROFILE, 200))
      if (url.includes('/users/me/requests')) return new Promise<Response>(() => {})
      throw new Error(`Unhandled fetch call: ${url}`)
    })
    renderPage()
    expect(screen.getByText('Loading your requests…')).toBeInTheDocument()
  })

  it('shows the fetch error via AuthErrorBanner when requests fail to load', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Server exploded' } }, 500)],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Server exploded')).toBeInTheDocument())
  })
})
