import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { JPEG_HEADER, makeFile } from '@/test/photoFixtures'
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

// A fresh route map per call — mockFetchRoutes shifts responses off these
// arrays as they're consumed, so a shared object would be exhausted after
// the first test to spread it in.
function presignRoutes() {
  return {
    '/uploads/presign': [
      () =>
        jsonResponse(
          { upload_url: 'https://s3.example.com/upload-photo', public_url: 'https://storage.example.com/photos/broken.jpg', expires_in: 300 },
          200,
        ),
    ],
    '/upload-photo': [() => ({ ok: true, status: 200 }) as Response],
  }
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
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({} as ImageBitmap))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the transaction history fetched from GET /reservations/{id}/transactions', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/requests?page=1&limit=50': [() => jsonResponse({ reservations: [RESERVATION], page: 1, limit: 50, total: 1 }, 200)],
      [`/reservations/${RESERVATION.id}/transactions`]: [() => jsonResponse([TRANSACTION], 200)],
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
      ...presignRoutes(),
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await user.type(screen.getByLabelText('What went wrong?'), 'The drill bit was broken')
    await user.upload(screen.getByLabelText('Photo'), makeFile(JPEG_HEADER, 'broken.jpg', 'image/jpeg'))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Photo' })).toBeInTheDocument())
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
        () => jsonResponse({ error: { code: 'INVALID_TRANSITION', message: 'Report already exists for this reservation' } }, 409),
      ],
      ...presignRoutes(),
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await user.type(screen.getByLabelText('What went wrong?'), 'The drill bit was broken')
    await user.upload(screen.getByLabelText('Photo'), makeFile(JPEG_HEADER, 'broken.jpg', 'image/jpeg'))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Photo' })).toBeInTheDocument())
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
      ...presignRoutes(),
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await user.type(screen.getByLabelText('What went wrong?'), 'The drill bit was broken')
    await user.upload(screen.getByLabelText('Photo'), makeFile(JPEG_HEADER, 'broken.jpg', 'image/jpeg'))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Photo' })).toBeInTheDocument())
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
    })

    renderPage()
    await waitFor(() => expect(screen.getByText(TRANSACTION.type)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Close reservation' }))

    await waitFor(() => expect(screen.getByText('Cannot close: an active problem report exists')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Close reservation' })).not.toBeDisabled()
  })
})
