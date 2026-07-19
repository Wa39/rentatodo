import { test as base, expect } from '@playwright/test'

const MOCK_TOKEN = 'e2e-test-token'

const MOCK_USER = {
  id: '1',
  name: 'Ana Dueña',
  email: 'owner@rentatodo.dev',
  created_at: '2024-01-01T00:00:00Z',
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/auth/login', (route) =>
      route.fulfill({ json: { access_token: MOCK_TOKEN, token_type: 'bearer', expires_in: 3600 } })
    )
    await page.route('**/users/me', (route) =>
      route.fulfill({ json: MOCK_USER })
    )
    await use(page)
  },
})

export { expect }
