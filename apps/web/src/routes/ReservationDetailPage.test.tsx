import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { ReservationDetailPage } from './ReservationDetailPage'

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
  id: '77777777-7777-4777-8777-777777777777',
  item_id: '33333333-3333-4333-8333-333333333333',
  item_name: 'Carpa Camping 4 personas',
  item_photo_url: 'https://storage.example.com/photos/carpa.jpg',
  renter_id: '88888888-8888-4888-8888-888888888888',
  renter_name: 'Camila Ríos',
  start_date: '2026-07-10',
  end_date: '2026-07-12',
  status: 'delivered',
  deposit_amount: 4500,
  deposit_status: 'held',
  checkin_photo_url: null,
  checkout_photo_url: null,
  created_at: '2026-07-08T09:00:00Z',
  updated_at: '2026-07-10T08:00:00Z',
}

const TRANSACTION = { id: 't1', reservation_id: RESERVATION.id, type: 'hold', amount: 4500, created_at: '2026-07-10T08:00:00Z' }

function renderPage() {
  return render(
    <AuthProvider>
      <RequestsProvider>
        <MemoryRouter initialEntries={[`/reservations/${RESERVATION.id}`]}>
          <Routes>
            <Route path="/reservations/:id" element={<ReservationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('ReservationDetailPage', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('rentatodo_token', 'tok123')
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the transaction history fetched from GET /reservations/{id}/transactions', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
      [`/reservations/${RESERVATION.id}/report`]: [() => jsonResponse({ error: { code: 'NOT_FOUND', message: 'No report' } }, 404)],
    })

    renderPage()

    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())
  })

  it('shows a deposit-history error banner without crashing the page', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [
        () => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Transactions server exploded' } }, 500),
      ],
      [`/reservations/${RESERVATION.id}/report`]: [() => jsonResponse({ error: { code: 'NOT_FOUND', message: 'No report' } }, 404)],
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Transactions server exploded')).toBeInTheDocument())
  })

  it('submits the report form via POST /reservations/{id}/report, then refetches transactions', async () => {
    const user = userEvent.setup({ delay: null })
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [
        () => jsonResponse([TRANSACTION], 200),
        () => jsonResponse([TRANSACTION, { id: 't2', reservation_id: RESERVATION.id, type: 'freeze', amount: 4500, created_at: '2026-07-27T10:00:00Z' }], 200),
      ],
      [`/reservations/${RESERVATION.id}/report`]: [
        () => jsonResponse({ error: { code: 'NOT_FOUND', message: 'No report' } }, 404),
        () =>
          jsonResponse(
            {
              id: 'rep1',
              reservation_id: RESERVATION.id,
              reported_by: PROFILE.id,
              reason: 'The drill bit was broken',
              photo_url: 'https://storage.example.com/photos/broken.jpg',
              created_at: '2026-07-27T10:00:00Z',
            },
            201,
          ),
      ],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('What went wrong?')).toBeInTheDocument())

    await user.type(screen.getByLabelText('What went wrong?'), 'The drill bit was broken')
    await user.type(screen.getByLabelText('Photo URL'), 'https://storage.example.com/photos/broken.jpg')
    await user.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(screen.getByText('Report submitted.')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('freeze')).toBeInTheDocument())
  })

  it('shows a report-submit error and keeps the form visible so the user can retry', async () => {
    const user = userEvent.setup({ delay: null })
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
      [`/reservations/${RESERVATION.id}/report`]: [
        () => jsonResponse({ error: { code: 'NOT_FOUND', message: 'No report' } }, 404),
        () => jsonResponse({ error: { code: 'INVALID_TRANSITION', message: 'Report already exists for this reservation' } }, 409),
      ],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('What went wrong?')).toBeInTheDocument())

    await user.type(screen.getByLabelText('What went wrong?'), 'The drill bit was broken')
    await user.type(screen.getByLabelText('Photo URL'), 'https://storage.example.com/photos/broken.jpg')
    await user.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(screen.getByText('Report already exists for this reservation')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Submit report' })).toBeInTheDocument()
  })

  it('shows a transactions-refresh error (without hiding the report-submitted success) when the report succeeds but the post-submit refetch fails', async () => {
    const user = userEvent.setup({ delay: null })
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [
        () => jsonResponse([TRANSACTION], 200),
        () => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Transactions server exploded' } }, 500),
      ],
      [`/reservations/${RESERVATION.id}/report`]: [
        () => jsonResponse({ error: { code: 'NOT_FOUND', message: 'No report' } }, 404),
        () =>
          jsonResponse(
            {
              id: 'rep1',
              reservation_id: RESERVATION.id,
              reported_by: PROFILE.id,
              reason: 'The drill bit was broken',
              photo_url: 'https://storage.example.com/photos/broken.jpg',
              created_at: '2026-07-27T10:00:00Z',
            },
            201,
          ),
      ],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('What went wrong?')).toBeInTheDocument())

    await user.type(screen.getByLabelText('What went wrong?'), 'The drill bit was broken')
    await user.type(screen.getByLabelText('Photo URL'), 'https://storage.example.com/photos/broken.jpg')
    await user.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(screen.getByText('Report submitted.')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('Transactions server exploded')).toBeInTheDocument())
  })

  it('closes the reservation via PATCH /reservations/{id}/close, refetches requests and transactions', async () => {
    const user = userEvent.setup({ delay: null })
    const RETURNED = { ...RESERVATION, status: 'returned' }
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [
        () => jsonResponse({ reservations: [RETURNED], page: 1, limit: 50, total: 1 }, 200),
        () => jsonResponse({ reservations: [{ ...RETURNED, status: 'closed' }], page: 1, limit: 50, total: 1 }, 200),
      ],
      [`/reservations/${RESERVATION.id}/transactions`]: [
        () => jsonResponse([TRANSACTION], 200),
        () =>
          jsonResponse(
            [TRANSACTION, { id: 't2', reservation_id: RESERVATION.id, type: 'release', amount: 4500, created_at: '2026-07-28T10:00:00Z' }],
            200,
          ),
      ],
      [`/reservations/${RESERVATION.id}/close`]: [() => jsonResponse({ ...RETURNED, status: 'closed' }, 200)],
      [`/reservations/${RESERVATION.id}/report`]: [() => jsonResponse({ error: { code: 'NOT_FOUND', message: 'No report' } }, 404)],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Close reservation' }))

    await waitFor(() => expect(screen.getByText(`${RESERVATION.start_date} → ${RESERVATION.end_date} · closed`)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('release')).toBeInTheDocument())
  })

  it('shows a close error and keeps the button enabled for retry when the close call fails', async () => {
    const user = userEvent.setup({ delay: null })
    const RETURNED = { ...RESERVATION, status: 'returned' }
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RETURNED], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
      [`/reservations/${RESERVATION.id}/close`]: [
        () => jsonResponse({ error: { code: 'FREEZE_ACTIVE', message: 'Cannot close: an active problem report exists' } }, 409),
      ],
      [`/reservations/${RESERVATION.id}/report`]: [() => jsonResponse({ error: { code: 'NOT_FOUND', message: 'No report' } }, 404)],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Close reservation' }))

    await waitFor(() => expect(screen.getByText('Cannot close: an active problem report exists')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Close reservation' })).not.toBeDisabled()
  })

  it('shows a placeholder for check-in/check-out photos that have not happened yet', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
      [`/reservations/${RESERVATION.id}/report`]: [() => jsonResponse({ error: { code: 'NOT_FOUND', message: 'No report' } }, 404)],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    expect(screen.getByText('Not checked in yet')).toBeInTheDocument()
    expect(screen.getByText('Not checked out yet')).toBeInTheDocument()
  })

  it('shows check-in/check-out thumbnails and opens the lightbox on click', async () => {
    const WITH_PHOTOS = {
      ...RESERVATION,
      checkin_photo_url: 'https://storage.example.com/photos/checkin.jpg',
      checkout_photo_url: 'https://storage.example.com/photos/checkout.jpg',
    }
    const user = userEvent.setup({ delay: null })
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [WITH_PHOTOS], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
      [`/reservations/${RESERVATION.id}/report`]: [() => jsonResponse({ error: { code: 'NOT_FOUND', message: 'No report' } }, 404)],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    expect(screen.queryByText('Not checked in yet')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View check-in photo' }))
    expect(screen.getByRole('img', { name: 'Enlarged photo' })).toHaveAttribute('src', WITH_PHOTOS.checkin_photo_url)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Enlarged photo' })).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'View check-out photo' }))
    expect(screen.getByRole('img', { name: 'Enlarged photo' })).toHaveAttribute('src', WITH_PHOTOS.checkout_photo_url)
  })

  it('shows the read-only report card instead of the form once a report has been filed', async () => {
    const REPORT = {
      id: 'rep1',
      reservation_id: RESERVATION.id,
      reported_by: '88888888-8888-4888-8888-888888888888',
      reason: 'The drill bit was broken',
      photo_url: 'https://storage.example.com/photos/broken.jpg',
      created_at: '2026-07-27T10:00:00Z',
    }
    const user = userEvent.setup({ delay: null })
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
      [`/reservations/${RESERVATION.id}/report`]: [() => jsonResponse(REPORT, 200)],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await waitFor(() => expect(screen.getByText(REPORT.reason)).toBeInTheDocument())
    expect(screen.getByText(REPORT.created_at)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit report' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View report photo' }))
    expect(screen.getByRole('img', { name: 'Enlarged photo' })).toHaveAttribute('src', REPORT.photo_url)
  })

  it('shows a report-load error banner without hiding the rest of the page', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
      [`/reservations/${RESERVATION.id}/report`]: [
        () => jsonResponse({ error: { code: 'SERVER_ERROR', message: 'Report server exploded' } }, 500),
      ],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await waitFor(() => expect(screen.getByText('Report server exploded')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Submit report' })).toBeInTheDocument()
  })

  it('shows both check-in/check-out photos and an existing report at the same time', async () => {
    const WITH_PHOTOS = {
      ...RESERVATION,
      checkin_photo_url: 'https://storage.example.com/photos/checkin.jpg',
      checkout_photo_url: 'https://storage.example.com/photos/checkout.jpg',
    }
    const REPORT = {
      id: 'rep1',
      reservation_id: RESERVATION.id,
      reported_by: '88888888-8888-4888-8888-888888888888',
      reason: 'The drill bit was broken',
      photo_url: 'https://storage.example.com/photos/broken.jpg',
      created_at: '2026-07-27T10:00:00Z',
    }
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [WITH_PHOTOS], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
      [`/reservations/${RESERVATION.id}/report`]: [() => jsonResponse(REPORT, 200)],
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'View check-in photo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View check-out photo' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(REPORT.reason)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Submit report' })).not.toBeInTheDocument()
  })
})
