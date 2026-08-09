import {
  test,
  expect,
  MOCK_RETURNED_RESERVATION,
  ALL_MOCK_RESERVATIONS,
  PNG_1x1,
  mockPhotoUpload,
} from '../fixtures'

// IDs match fixtures in ../fixtures.ts — RequestsContext uses the mocked GET /users/me/requests
// route and transaction history comes from the mocked GET /reservations/*/transactions route.
const REQUESTED_ID = '55555555-5555-4555-8555-555555555555' // Taladro, status=requested, no transactions
const DELIVERED_ID = '77777777-7777-4777-8777-777777777777' // Carpa, status=delivered, has a hold tx
const RETURNED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' // Taladro, status=returned (enables Close button)

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
  await mockPhotoUpload(page)

  // Report form is only shown for delivered/returned reservations (API enforces this).
  await page.goto(`/reservations/${DELIVERED_ID}`)
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible()
  await page.getByLabel('What went wrong?').fill('Item was damaged on arrival')
  await page.locator('#report-photo').setInputFiles({
    name: 'evidence.png',
    mimeType: 'image/png',
    buffer: PNG_1x1,
  })
  await expect(page.getByRole('img', { name: 'Photo' })).toBeVisible()
  await page.getByRole('button', { name: 'Submit report' }).click()
  await expect(page.getByText('Report submitted.')).toBeVisible()
})

test('close reservation button is enabled when status is returned', async ({ page }) => {
  await page.goto(`/reservations/${RETURNED_ID}`)
  const closeBtn = page.getByRole('button', { name: 'Close reservation' })
  await expect(closeBtn).toBeVisible()
  await expect(closeBtn).toBeEnabled()
})

test('closing a returned reservation updates status to closed and disables the button', async ({ page }) => {
  const closed = { ...MOCK_RETURNED_RESERVATION, status: 'closed', deposit_status: 'released' }
  let didClose = false

  await page.route(`**/reservations/${RETURNED_ID}/close`, (route) => {
    didClose = true
    route.fulfill({ json: closed })
  })
  // Override the fixture's default GET /users/me/requests to return the updated
  // status after the PATCH fires. Playwright's LIFO route order means this handler
  // takes priority over the fixture's catch-all for both the initial load and the
  // refetch that RequestsContext does after closeRequest() resolves.
  await page.route('**/users/me/requests?**', (route) =>
    route.fulfill({
      json: {
        reservations: didClose
          ? ALL_MOCK_RESERVATIONS.map((r) => (r.id === RETURNED_ID ? closed : r))
          : [...ALL_MOCK_RESERVATIONS],
        page: 1,
        limit: 20,
        total: ALL_MOCK_RESERVATIONS.length,
      },
    }),
  )

  await page.goto(`/reservations/${RETURNED_ID}`)
  await expect(page.getByText('2026-06-20 → 2026-06-22 · returned')).toBeVisible()

  await page.getByRole('button', { name: 'Close reservation' }).click()

  await expect(page.getByText('2026-06-20 → 2026-06-22 · closed')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close reservation' })).toBeDisabled()
})

test('navigating to a non-existent reservation shows not-found message', async ({ page }) => {
  await page.goto('/reservations/00000000-0000-0000-0000-000000000000')
  await expect(page.getByText('Reservation not found.')).toBeVisible()
})
