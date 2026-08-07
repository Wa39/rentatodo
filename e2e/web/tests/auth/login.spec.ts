import { test, expect, TEST_CREDENTIALS } from '../fixtures'

test('happy-path login redirects to dashboard', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  await page.getByLabel('Email').fill(TEST_CREDENTIALS.email)
  await page.getByLabel('Password').fill(TEST_CREDENTIALS.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
})

// These tests must start without a session — override the project-level storageState.
test.describe('unauthenticated redirects', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('visiting /dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('visiting / redirects to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })
})
