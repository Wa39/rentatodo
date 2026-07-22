import { test, expect } from '../fixtures'

test('earnings page shows KPI cards', async ({ page }) => {
  await page.goto('/earnings')
  await expect(page.getByRole('heading', { name: 'Earnings' })).toBeVisible()
  await expect(page.getByText('Total earned')).toBeVisible()
  await expect(page.getByText('This month')).toBeVisible()
  await expect(page.getByText('Closed reservations')).toBeVisible()
})

test('earnings page shows monthly chart and per-item breakdown', async ({ page }) => {
  await page.goto('/earnings')
  await expect(page.getByText('Earnings by month')).toBeVisible()
  await expect(page.getByText('By item')).toBeVisible()
  // mockEarnings seeds two items; assert the first one appears
  await expect(page.getByText('Taladro Bosch Professional')).toBeVisible()
})
