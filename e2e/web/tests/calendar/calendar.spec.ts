import { test, expect, MOCK_USER } from '../fixtures'

// Two items whose IDs match the item_id fields in ALL_MOCK_RESERVATIONS (fixtures.ts).
// Taladro: MOCK_PENDING_REQUEST + MOCK_RETURNED_RESERVATION + MOCK_CLOSED_RESERVATION
// Carpa:   MOCK_DELIVERED_RESERVATION + MOCK_REJECTED_RESERVATION
const MOCK_ITEM_TALADRO = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Taladro Bosch Professional',
  category: 'tools',
  price_per_day: 1000,
  photo_url: 'https://example.com/taladro.jpg',
  is_active: true,
  owner_id: MOCK_USER.id,
  created_at: '2026-01-01T00:00:00Z',
} as const

const MOCK_ITEM_CARPA = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Carpa Camping 4 personas',
  category: 'outdoors',
  price_per_day: 1500,
  photo_url: 'https://example.com/carpa.jpg',
  is_active: true,
  owner_id: MOCK_USER.id,
  created_at: '2026-01-01T00:00:00Z',
} as const

test('calendar page shows empty state when owner has no items', async ({ page }) => {
  // GET /users/me/items is mocked to return [] in fixtures.ts
  await page.goto('/requests/calendar')
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
  await expect(
    page.getByText("You don't have any items yet. Publish one to see its calendar."),
  ).toBeVisible()
})

test('calendar page shows item name, select dropdown, and legend when items exist', async ({ page }) => {
  await page.route('**/users/me/items', (route) =>
    route.fulfill({ json: [MOCK_ITEM_TALADRO, MOCK_ITEM_CARPA] }),
  )
  await page.goto('/requests/calendar')

  // Select dropdown lists both items; first item is auto-selected
  const select = page.getByRole('combobox', { name: 'Calendar' })
  await expect(select).toBeVisible()
  await expect(select).toHaveValue(MOCK_ITEM_TALADRO.id)

  // Item name appears as the section heading
  await expect(page.getByRole('heading', { name: 'Taladro Bosch Professional', level: 2 })).toBeVisible()

  // Legend labels confirm the calendar grids rendered.
  // Scope to the header row (h2's parent) — 'Pending' also appears as a status badge
  // in the reservations list below, which would cause a strict-mode violation.
  const legendRow = page.getByRole('heading', { name: 'Taladro Bosch Professional', level: 2 }).locator('xpath=..')
  await expect(legendRow.getByText('Available')).toBeVisible()
  await expect(legendRow.getByText('Pending')).toBeVisible()
  await expect(legendRow.getByText('Reserved')).toBeVisible()
})

test('reservations list shows only the selected item reservations', async ({ page }) => {
  await page.route('**/users/me/items', (route) =>
    route.fulfill({ json: [MOCK_ITEM_TALADRO, MOCK_ITEM_CARPA] }),
  )
  await page.goto('/requests/calendar')

  await expect(page.getByText('Reservations for this item')).toBeVisible()

  // Taladro has MOCK_PENDING_REQUEST (Jorge Salas), MOCK_RETURNED_RESERVATION (Luz Fernández),
  // and MOCK_CLOSED_RESERVATION (Sofía Guzmán) in ALL_MOCK_RESERVATIONS
  await expect(page.getByRole('link', { name: /Jorge Salas/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Luz Fernández/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Sofía Guzmán/ })).toBeVisible()

  // Carpa renters must NOT appear while Taladro is selected
  await expect(page.getByRole('link', { name: /Camila Ríos/ })).not.toBeVisible()
})

test('switching the item dropdown updates the heading and reservations', async ({ page }) => {
  await page.route('**/users/me/items', (route) =>
    route.fulfill({ json: [MOCK_ITEM_TALADRO, MOCK_ITEM_CARPA] }),
  )
  await page.goto('/requests/calendar')

  await page.getByRole('combobox', { name: 'Calendar' }).selectOption(MOCK_ITEM_CARPA.id)

  await expect(page.getByRole('heading', { name: 'Carpa Camping 4 personas', level: 2 })).toBeVisible()

  // Carpa has MOCK_DELIVERED_RESERVATION (Camila Ríos) and MOCK_REJECTED_RESERVATION (Pablo Díaz)
  await expect(page.getByRole('link', { name: /Camila Ríos/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Pablo Díaz/ })).toBeVisible()

  // Taladro renters must not appear after the switch
  await expect(page.getByRole('link', { name: /Jorge Salas/ })).not.toBeVisible()
})

test('calendar shows not-found message when ?item= points to an unknown id', async ({ page }) => {
  await page.route('**/users/me/items', (route) =>
    route.fulfill({ json: [MOCK_ITEM_TALADRO] }),
  )
  await page.goto('/requests/calendar?item=unknown-item-id')
  await expect(page.getByText("This item doesn't exist or is no longer yours.")).toBeVisible()
})
