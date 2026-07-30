import { test, expect, MOCK_PENDING_REQUEST, ALL_MOCK_RESERVATIONS } from '../fixtures'

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

test('approving a request from the dashboard removes it from the pending section', async ({ page }) => {
  const approved = { ...MOCK_PENDING_REQUEST, status: 'approved', deposit_status: 'held' }
  let didApprove = false

  // After approve, refetch returns the updated list with no 'requested' entries.
  await page.route('**/users/me/requests?**', (route) =>
    route.fulfill({
      json: {
        reservations: didApprove
          ? ALL_MOCK_RESERVATIONS.map((r) => (r.id === MOCK_PENDING_REQUEST.id ? approved : r))
          : [...ALL_MOCK_RESERVATIONS],
        page: 1,
        limit: 20,
        total: ALL_MOCK_RESERVATIONS.length,
      },
    }),
  )
  await page.route(`**/reservations/${MOCK_PENDING_REQUEST.id}/approve`, (route) => {
    didApprove = true
    route.fulfill({ json: approved })
  })

  await page.goto('/dashboard')
  await expect(page.getByText('Jorge Salas requested Taladro Bosch Professional')).toBeVisible()

  await page.getByRole('button', { name: 'Approve' }).click()

  // Pending card disappears once the request is no longer 'requested'
  await expect(page.getByText('Jorge Salas requested Taladro Bosch Professional')).not.toBeVisible()
})

test('rejecting a request from the dashboard removes it from the pending section', async ({ page }) => {
  const rejected = { ...MOCK_PENDING_REQUEST, status: 'rejected' }
  let didReject = false

  await page.route('**/users/me/requests?**', (route) =>
    route.fulfill({
      json: {
        reservations: didReject
          ? ALL_MOCK_RESERVATIONS.map((r) => (r.id === MOCK_PENDING_REQUEST.id ? rejected : r))
          : [...ALL_MOCK_RESERVATIONS],
        page: 1,
        limit: 20,
        total: ALL_MOCK_RESERVATIONS.length,
      },
    }),
  )
  await page.route(`**/reservations/${MOCK_PENDING_REQUEST.id}/reject`, (route) => {
    didReject = true
    route.fulfill({ json: rejected })
  })

  await page.goto('/dashboard')
  await expect(page.getByText('Jorge Salas requested Taladro Bosch Professional')).toBeVisible()

  await page.getByRole('button', { name: 'Reject' }).click()

  await expect(page.getByText('Jorge Salas requested Taladro Bosch Professional')).not.toBeVisible()
})
