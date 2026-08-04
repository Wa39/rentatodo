import { test, expect, MOCK_USER } from '../fixtures'

// Active item used by the delete-dialog specs. ID uses a distinct pattern to
// avoid collisions with reservation/transaction mocks in fixtures.ts.
const MOCK_ITEM = {
  id: 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1',
  name: 'Taladro Bosch Professional',
  description: 'A reliable drill for home projects.',
  category: 'tools',
  price_per_day: 1000,
  photo_url: 'https://storage.example.com/photos/taladro.jpg',
  is_active: true,
  owner_id: MOCK_USER.id,
  owner_name: MOCK_USER.name,
  created_at: '2026-01-01T00:00:00Z',
} as const

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

test('delete button opens a confirmation dialog showing the item name', async ({ page }) => {
  await page.route('**/users/me/items', (route) =>
    route.fulfill({ json: [MOCK_ITEM] })
  )
  await page.goto('/items')
  const card = page.getByTestId(`item-card-${MOCK_ITEM.id}`)
  await card.getByRole('button', { name: 'Delete' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Delete this item?')).toBeVisible()
  await expect(dialog).toContainText(MOCK_ITEM.name)
})

test('cancel in the delete dialog dismisses without deleting', async ({ page }) => {
  await page.route('**/users/me/items', (route) =>
    route.fulfill({ json: [MOCK_ITEM] })
  )
  await page.goto('/items')
  const card = page.getByTestId(`item-card-${MOCK_ITEM.id}`)
  await card.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(card.getByRole('button', { name: 'Delete' })).toBeVisible()
})

test('confirming delete calls DELETE /items/{id} and removes the item', async ({ page }) => {
  let deleted = false
  await page.route('**/users/me/items', (route) =>
    route.fulfill({ json: deleted ? [] : [MOCK_ITEM] })
  )
  await page.route(`**/items/${MOCK_ITEM.id}`, (route) => {
    deleted = true
    route.fulfill({ status: 204, body: '' })
  })
  await page.goto('/items')
  const card = page.getByTestId(`item-card-${MOCK_ITEM.id}`)
  await card.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Delete item' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(card).not.toBeVisible()
})
