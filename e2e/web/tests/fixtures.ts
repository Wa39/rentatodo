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
    await use(page)
  },
})

export { expect }
