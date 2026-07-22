import { test as setup, TEST_CREDENTIALS } from './fixtures'
import { AUTH_FILE } from '../playwright.config'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(TEST_CREDENTIALS.email)
  await page.getByLabel('Password').fill(TEST_CREDENTIALS.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/dashboard')
  await page.context().storageState({ path: AUTH_FILE })
})
