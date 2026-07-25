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
    // so the requests page renders without a real API server.
    await page.route('**/users/me/requests', (route) =>
      route.fulfill({
        json: { reservations: [MOCK_PENDING_REQUEST], page: 1, limit: 20, total: 1 },
      })
    )
    await use(page)
  },
})

export { expect }
