import { test, expect } from '../fixtures'

// IDs come from mockRequests in apps/web/src/lib/mockData.ts.
// The page uses RequestsContext (mock data — no real API call needed).
const REQUESTED_ID = '55555555-5555-4555-8555-555555555555' // Taladro, status=requested, no transactions
const DELIVERED_ID = '77777777-7777-4777-8777-777777777777' // second item, status=delivered, has a hold tx

test('shows item name, date range and status for a pending reservation', async ({ page }) => {
  await page.goto(`/reservations/${REQUESTED_ID}`)
  await expect(page.getByRole('heading', { name: 'Taladro Bosch Professional' })).toBeVisible()
  await expect(page.getByText('2026-07-18 → 2026-07-20 · requested')).toBeVisible()
})

test('Close reservation button is disabled when status is not returned', async ({ page }) => {
  await page.goto(`/reservations/${REQUESTED_ID}`)
  const closeBtn = page.getByRole('button', { name: 'Close reservation' })
  await expect(closeBtn).toBeVisible()
  await expect(closeBtn).toBeDisabled()
})

test('deposit history table renders with Type / Amount / Date columns', async ({ page }) => {
  await page.goto(`/reservations/${REQUESTED_ID}`)
  await expect(page.getByRole('heading', { name: 'Deposit history' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible()
})

test('delivered reservation shows a hold transaction row in the deposit history', async ({ page }) => {
  await page.goto(`/reservations/${DELIVERED_ID}`)
  await expect(page.getByRole('cell', { name: 'hold' })).toBeVisible()
})

test('report form shows confirmation after submit', async ({ page }) => {
  await page.goto(`/reservations/${REQUESTED_ID}`)
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible()
  await page.getByLabel('What went wrong?').fill('Item was damaged on arrival')
  await page.getByLabel('Photo URL').fill('https://example.com/evidence.jpg')
  await page.getByRole('button', { name: 'Submit report' }).click()
  await expect(page.getByText('Report submitted.')).toBeVisible()
})

test('navigating to a non-existent reservation shows not-found message', async ({ page }) => {
  await page.goto('/reservations/00000000-0000-0000-0000-000000000000')
  await expect(page.getByText('Reservation not found.')).toBeVisible()
})
