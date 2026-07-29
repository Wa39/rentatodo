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

test('publish form: clicking a category toggles its aria-pressed state', async ({ page }) => {
  await page.goto('/items/publish')
  // Default selection is 'tools' (first in CATEGORIES array)
  const toolsBtn = page.getByRole('button', { name: 'Tools' })
  const photoBtn = page.getByRole('button', { name: 'Photography' })
  await expect(toolsBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(photoBtn).toHaveAttribute('aria-pressed', 'false')
  await photoBtn.click()
  await expect(photoBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(toolsBtn).toHaveAttribute('aria-pressed', 'false')
})

test('publish form: submit button is disabled until a photo is chosen', async ({ page }) => {
  // Regression guard for PR #56 — submit must be blocked while photoUrl is empty.
  await page.goto('/items/publish')
  await page.getByLabel('Name').fill('Taladro Bosch Professional')
  await page.getByLabel('Price per day (USD)').fill('10')
  await page.getByLabel('Description').fill('A reliable drill for home projects.')
  // All required text fields are filled but no photo has been uploaded yet.
  await expect(page.getByRole('button', { name: 'Publish item' })).toBeDisabled()
})

test('publish form: cancel navigates back to the items list', async ({ page }) => {
  await page.goto('/items/publish')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'My items' })).toBeVisible()
})
