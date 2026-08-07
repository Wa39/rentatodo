import { test, expect, MOCK_PENDING_REQUEST, ALL_MOCK_RESERVATIONS } from '../fixtures'

test('requests page shows status filter buttons', async ({ page }) => {
  await page.goto('/requests')
  await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible()
  // Tabs are plain <button> elements, not ARIA tabs
  await expect(page.getByRole('button', { name: 'Pending' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Active' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'History' })).toBeVisible()
})

test('pending tab shows approve and reject buttons for the seeded request', async ({ page }) => {
  await page.goto('/requests')
  // Default tab is Pending; mockRequests seeds one requested reservation (Jorge Salas)
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible()
  await expect(page.getByText('Jorge Salas')).toBeVisible()
})

test('approving a request moves it off the pending tab', async ({ page }) => {
  const approved = { ...MOCK_PENDING_REQUEST, status: 'approved', deposit_status: 'held' }
  let didApprove = false

  // Override the fixture's static mock with a stateful one so the refetch
  // after approve returns the updated status (LIFO: this route wins over the
  // global mock registered in fixtures.ts).
  await page.route('**/users/me/requests?**', (route) =>
    route.fulfill({
      json: { reservations: [didApprove ? approved : MOCK_PENDING_REQUEST], page: 1, limit: 20, total: 1 },
    })
  )
  await page.route(`**/reservations/${MOCK_PENDING_REQUEST.id}/approve`, (route) => {
    didApprove = true
    route.fulfill({ json: approved })
  })

  await page.goto('/requests')
  await page.getByRole('button', { name: 'Approve' }).click()
  // Approve/Reject buttons should be gone — no more pending requests
  await expect(page.getByRole('button', { name: 'Approve' })).not.toBeVisible()
  // Jorge Salas now appears on the Active tab
  await page.getByRole('button', { name: 'Active' }).click()
  await expect(page.getByText('Jorge Salas')).toBeVisible()
})

test('rejecting a request moves it to the history tab', async ({ page }) => {
  const rejected = { ...MOCK_PENDING_REQUEST, status: 'rejected' }
  const withoutPending = ALL_MOCK_RESERVATIONS.filter((r) => r.id !== MOCK_PENDING_REQUEST.id)
  let didReject = false

  await page.route('**/users/me/requests?**', (route) =>
    route.fulfill({
      json: {
        reservations: didReject ? [...withoutPending, rejected] : [...ALL_MOCK_RESERVATIONS],
        page: 1,
        limit: 20,
        total: ALL_MOCK_RESERVATIONS.length,
      },
    })
  )
  await page.route(`**/reservations/${MOCK_PENDING_REQUEST.id}/reject`, (route) => {
    didReject = true
    route.fulfill({ json: rejected })
  })

  await page.goto('/requests')
  await page.getByRole('button', { name: 'Reject' }).click()
  await expect(page.getByRole('button', { name: 'Reject' })).not.toBeVisible()
  await page.getByRole('button', { name: 'History' }).click()
  await expect(page.getByText('Jorge Salas')).toBeVisible()
})

test('active tab shows delivered and returned reservations', async ({ page }) => {
  await page.goto('/requests')
  await page.getByRole('button', { name: 'Active' }).click()
  // fixture seeds Camila Ríos (delivered) and Luz Fernández (returned)
  await expect(page.getByText('Camila Ríos')).toBeVisible()
  await expect(page.getByText('Luz Fernández')).toBeVisible()
})

test('history tab shows closed and rejected reservations', async ({ page }) => {
  await page.goto('/requests')
  await page.getByRole('button', { name: 'History' }).click()
  // fixture seeds Sofía Guzmán (closed) and Pablo Díaz (rejected)
  await expect(page.getByText('Sofía Guzmán')).toBeVisible()
  await expect(page.getByText('Pablo Díaz')).toBeVisible()
})

test('search on the active tab filters visible entries by name', async ({ page }) => {
  await page.goto('/requests')
  await page.getByRole('button', { name: 'Active' }).click()
  await expect(page.getByText('Camila Ríos')).toBeVisible()
  await expect(page.getByText('Luz Fernández')).toBeVisible()
  await page.getByPlaceholder('Search by person or item…').fill('Camila')
  await expect(page.getByText('Camila Ríos')).toBeVisible()
  await expect(page.getByText('Luz Fernández')).not.toBeVisible()
})
