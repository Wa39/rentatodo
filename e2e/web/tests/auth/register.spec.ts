import { test, expect } from '../fixtures'

const MOCK_NEW_USER = {
  id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2026-01-01T00:00:00Z',
} as const

test('register form renders with all fields and a sign-in link', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()
  await expect(page.getByLabel('Name')).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
})

test('password shorter than 8 characters shows inline validation error', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Password').fill('short')
  await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible()
})

test('happy-path registration redirects to /dashboard', async ({ page }) => {
  // POST /auth/register is not yet mocked globally — add it only for this test.
  // POST /auth/login is already mocked in fixtures.ts and handles the auto-login
  // that AuthContext.register() triggers immediately after account creation.
  await page.route('**/auth/register', (route) =>
    route.fulfill({ json: MOCK_NEW_USER })
  )
  await page.goto('/register')
  await page.getByLabel('Name').fill('Test User')
  await page.getByLabel('Email').fill('test@example.com')
  await page.getByLabel('Password').fill('Rentatodo2026!')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('/dashboard')
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
})
