import { test, expect } from '@playwright/test'

test('items page shows heading and publish button', async ({ page }) => {
  await page.goto('/items')
  await expect(page.getByRole('heading', { name: 'My items' })).toBeVisible()
  await expect(page.getByRole('link', { name: /publish/i })).toBeVisible()
})

test('publish item page is accessible', async ({ page }) => {
  await page.goto('/items/publish')
  await expect(page).toHaveURL('/items/publish')
})
