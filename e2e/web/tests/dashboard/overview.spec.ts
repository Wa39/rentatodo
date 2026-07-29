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

test('welcome subtitle shows the signed-in user first name', async ({ page }) => {
  // MOCK_USER.name = 'Ana Dueña' → first name = 'Ana'
  await page.goto('/dashboard')
  await expect(page.getByText('Welcome back, Ana')).toBeVisible()
})

test('KPI values reflect the seeded mock reservations', async ({ page }) => {
  // Base fixture: items=[], ALL_MOCK_RESERVATIONS contains 5 reservations.
  // Active items       → 0  (items mock returns [])
  // Pending requests   → 1  (only MOCK_PENDING_REQUEST has status='requested')
  // Active reservations → 2  (MOCK_DELIVERED='delivered' + MOCK_RETURNED='returned',
  //                          both in RESERVED_STATUSES=['approved','delivered','returned'])
  await page.goto('/dashboard')

  const activeItemsCard = page.getByText('Active items', { exact: true }).locator('xpath=..')
  await expect(activeItemsCard.getByText('0')).toBeVisible()

  const pendingCard = page.getByText('Pending requests', { exact: true }).locator('xpath=..')
  await expect(pendingCard.getByText('1')).toBeVisible()

  const activeResCard = page.getByText('Active reservations', { exact: true }).locator('xpath=..')
  await expect(activeResCard.getByText('2')).toBeVisible()
})

test('recent requests section shows the pending renter and item name', async ({ page }) => {
  // MOCK_PENDING_REQUEST: Jorge Salas, Taladro Bosch Professional
  await page.goto('/dashboard')
  await expect(page.getByText('Jorge Salas requested Taladro Bosch Professional')).toBeVisible()
})

test('pending request card has approve and reject buttons', async ({ page }) => {
  await page.goto('/dashboard')
  // Only MOCK_PENDING_REQUEST is in 'requested' status so exactly one card renders.
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible()
})
