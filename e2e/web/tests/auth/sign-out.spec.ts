import { test, expect } from '../fixtures'

test.describe('Sign out', () => {
  test('log-out button redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('protected routes redirect to login after sign-out', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/login')
    await page.goto('/items')
    await expect(page).toHaveURL('/login')
  })
})
