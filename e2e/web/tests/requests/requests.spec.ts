import { test, expect } from '../fixtures'

test('requests page shows status filter buttons', async ({ page }) => {
  await page.goto('/requests')
  await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible()
  // Tabs are plain <button> elements, not ARIA tabs
  await expect(page.getByRole('button', { name: 'Pending' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Active' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'History' })).toBeVisible()
})
