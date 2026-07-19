import { test, expect } from '../fixtures'

test('dashboard overview shows KPI cards', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByText('Active items')).toBeVisible()
  await expect(page.getByText('Pending requests')).toBeVisible()
})

test('sidebar navigation links are present', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('link', { name: 'My items' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Requests' })).toBeVisible()
})
