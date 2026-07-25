import { test as base, expect } from '@playwright/test'

export const TEST_CREDENTIALS = {
  email: 'owner@rentatodo.dev',
  password: 'Rentatodo2026!',
} as const

export const MOCK_USER = {
  id: '1',
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
    // RequestsContext (PR #50) calls this on mount — return one pending request
    // and one delivered reservation so both the requests page and the
    // reservation-detail page render without a real API server.
    await page.route('**/users/me/requests?**', (route) =>
      route.fulfill({
        json: {
          reservations: [MOCK_PENDING_REQUEST, MOCK_DELIVERED_RESERVATION],
          page: 1,
          limit: 20,
          total: 2,
        },
      })
    )
    await use(page)
  },
})

export { expect }
