import { test, expect } from '../fixtures'

test('earnings page shows KPI cards', async ({ page }) => {
  await page.goto('/earnings')
  // Use the subtitle — it is unique to the earnings PageHeader and more
  // reliable than getByRole('heading') across accessibility tree variations.
  await expect(page.getByText('Track what each item earns you.')).toBeVisible()
  await expect(page.getByText('Total earned')).toBeVisible()
  await expect(page.getByText('This month')).toBeVisible()
  await expect(page.getByText('Closed reservations')).toBeVisible()
})

test('earnings page shows monthly chart and per-item breakdown', async ({ page }) => {
  await page.goto('/earnings')
  await expect(page.getByText('Earnings by month')).toBeVisible()
  await expect(page.getByText('By item')).toBeVisible()
  // mockEarnings seeds two items; assert the first one is listed
  await expect(page.getByText('Taladro Bosch Professional')).toBeVisible()
})
