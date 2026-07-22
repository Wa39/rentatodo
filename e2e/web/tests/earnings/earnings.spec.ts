import { test, expect } from '../fixtures'

test('earnings page shows KPI cards', async ({ page }) => {
  await page.goto('/earnings')
  // Use the subtitle — it is unique to the earnings PageHeader and more
  // reliable than getByRole('heading') across accessibility tree variations.
  await expect(page.getByText('Track what each item earns you.')).toBeVisible()
  await expect(page.getByText('Total earned')).toBeVisible()
  await expect(page.getByText('This month', { exact: true })).toBeVisible()
  await expect(page.getByText('Closed reservations')).toBeVisible()
})

test('earnings page shows monthly chart and per-item breakdown', async ({ page }) => {
  await page.goto('/earnings')
  await expect(page.getByText('Earnings by month')).toBeVisible()
  await expect(page.getByText('By item')).toBeVisible()
  // mockEarnings seeds two items; assert the first appears in the list.
  // .first() avoids strict-mode violation: the item name also appears in the
  // selected-item breakdown panel rendered beside the list.
  await expect(page.getByText('Taladro Bosch Professional').first()).toBeVisible()
})
