import { test, expect } from '@playwright/test'

test('requests page shows status tabs', async ({ page }) => {
  await page.goto('/requests')
  await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Active' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'History' })).toBeVisible()
})
