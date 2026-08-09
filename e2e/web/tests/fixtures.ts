import { test as base, expect } from '@playwright/test'

export const TEST_CREDENTIALS = {
  email: 'owner@rentatodo.dev',
  password: 'Rentatodo2026!',
} as const

export const MOCK_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ana Dueña',
  email: TEST_CREDENTIALS.email,
  created_at: '2024-01-01T00:00:00Z',
} as const

const MOCK_TOKEN = 'e2e-test-token'

export const MOCK_PENDING_REQUEST = {
  id: '55555555-5555-4555-8555-555555555555',
  item_id: '22222222-2222-4222-8222-222222222222',
  item_name: 'Taladro Bosch Professional',
  item_photo_url: 'https://storage.example.com/photos/taladro.jpg',
  renter_id: '66666666-6666-4666-8666-666666666666',
  renter_name: 'Jorge Salas',
  start_date: '2026-07-18',
  end_date: '2026-07-20',
  status: 'requested',
  deposit_amount: 2000,
  deposit_status: 'none',
  created_at: '2026-07-14T12:00:00Z',
  updated_at: '2026-07-14T12:00:00Z',
} as const

// ReservationDetailPage still reads its transaction history from mockTransactions
// (apps/web/src/lib/mockData.ts), which keys a 'hold' transaction to this id —
// so this reservation must keep the same id for that page's e2e test to find it.
export const MOCK_DELIVERED_RESERVATION = {
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
} as const

// status=returned — enables the Close reservation button in reservation-detail tests
export const MOCK_RETURNED_RESERVATION = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  item_id: '22222222-2222-4222-8222-222222222222',
  item_name: 'Taladro Bosch Professional',
  item_photo_url: 'https://storage.example.com/photos/taladro.jpg',
  renter_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  renter_name: 'Luz Fernández',
  start_date: '2026-06-20',
  end_date: '2026-06-22',
  status: 'returned',
  deposit_amount: 2000,
  deposit_status: 'held',
  created_at: '2026-06-18T12:00:00Z',
  updated_at: '2026-06-22T10:00:00Z',
} as const

export const MOCK_CLOSED_RESERVATION = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  item_id: '22222222-2222-4222-8222-222222222222',
  item_name: 'Taladro Bosch Professional',
  item_photo_url: 'https://storage.example.com/photos/taladro.jpg',
  renter_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  renter_name: 'Sofía Guzmán',
  start_date: '2026-07-01',
  end_date: '2026-07-03',
  status: 'closed',
  deposit_amount: 3000,
  deposit_status: 'released',
  created_at: '2026-06-28T10:00:00Z',
  updated_at: '2026-07-04T09:00:00Z',
} as const

export const MOCK_REJECTED_RESERVATION = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  item_id: '33333333-3333-4333-8333-333333333333',
  item_name: 'Carpa Camping 4 personas',
  item_photo_url: 'https://storage.example.com/photos/carpa.jpg',
  renter_id: 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0',
  renter_name: 'Pablo Díaz',
  start_date: '2026-07-05',
  end_date: '2026-07-06',
  status: 'rejected',
  deposit_amount: 4000,
  deposit_status: 'none',
  created_at: '2026-07-03T11:00:00Z',
  updated_at: '2026-07-03T15:00:00Z',
} as const

export const ALL_MOCK_RESERVATIONS = [
  MOCK_PENDING_REQUEST,
  MOCK_DELIVERED_RESERVATION,
  MOCK_RETURNED_RESERVATION,
  MOCK_CLOSED_RESERVATION,
  MOCK_REJECTED_RESERVATION,
] as const

export const MOCK_EARNINGS = {
  total_earnings: 7000,
  by_item: [
    {
      item_id: '22222222-2222-4222-8222-222222222222',
      item_name: 'Taladro Bosch Professional',
      total: 3000,
      rentals: [{ start_date: '2026-06-01', end_date: '2026-06-03', amount: 3000 }],
    },
    {
      item_id: '33333333-3333-4333-8333-333333333333',
      item_name: 'Carpa Camping 4 personas',
      total: 4000,
      rentals: [{ start_date: '2026-06-10', end_date: '2026-06-12', amount: 4000 }],
    },
  ],
} as const

export const MOCK_HOLD_TRANSACTION = {
  id: 'tttttttt-tttt-4ttt-8ttt-tttttttttttt',
  reservation_id: MOCK_DELIVERED_RESERVATION.id,
  type: 'hold',
  amount: MOCK_DELIVERED_RESERVATION.deposit_amount,
  created_at: '2026-07-10T08:00:00Z',
} as const

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/auth/login', (route) =>
      route.fulfill({ json: { access_token: MOCK_TOKEN, token_type: 'bearer', expires_in: 3600 } })
    )
    await page.route('**/users/me', (route) =>
      route.fulfill({ json: MOCK_USER })
    )
    // ItemsContext (PR #40) calls this on mount — return empty list so the
    // items page renders without a real API server.
    await page.route('**/users/me/items', (route) =>
      route.fulfill({ json: [] })
    )
    // RequestsContext (PR #50) calls this on mount — seed all reservation
    // statuses so every tab (Pending/Active/History) has data in tests.
    await page.route('**/users/me/requests?**', (route) =>
      route.fulfill({
        json: {
          reservations: [...ALL_MOCK_RESERVATIONS],
          page: 1,
          limit: 20,
          total: ALL_MOCK_RESERVATIONS.length,
        },
      })
    )
    await page.route('**/users/me/earnings', (route) =>
      route.fulfill({ json: MOCK_EARNINGS })
    )
    await page.route('**/reservations/*/transactions', (route) =>
      route.fulfill({ json: [MOCK_HOLD_TRANSACTION] })
    )
    await page.route('**/reservations/*/report', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 404,
          json: { error: { code: 'NOT_FOUND', message: 'No report has been filed for this reservation' } },
        })
      }
      return route.fulfill({
        status: 201,
        json: {
          id: 'rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr',
          reservation_id: MOCK_DELIVERED_RESERVATION.id,
          reported_by: MOCK_USER.id,
          reason: 'Item was damaged on arrival',
          photo_url: 'https://example.com/evidence.jpg',
          created_at: '2026-07-28T10:00:00Z',
        },
      })
    })
    await use(page)
  },
})

export { expect }
