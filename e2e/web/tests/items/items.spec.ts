import { test, expect } from '../fixtures'

test('items page shows heading and publish button', async ({ page }) => {
  await page.goto('/items')
  await expect(page.getByRole('heading', { name: 'My items' })).toBeVisible()
  await expect(page.getByRole('link', { name: '+ Publish item' })).toBeVisible()
})

test('publish item form renders', async ({ page }) => {
  await page.goto('/items/publish')
  await expect(page.getByRole('heading', { name: 'Publish item' })).toBeVisible()
})
