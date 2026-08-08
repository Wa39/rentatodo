import { test, expect, PNG_1x1, MOCK_UPLOAD_URL, MOCK_PHOTO_PUBLIC_URL } from '../fixtures'

test.describe('PublishItemPage — photo upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/uploads/presign', (route) =>
      route.fulfill({
        json: { upload_url: MOCK_UPLOAD_URL, public_url: MOCK_PHOTO_PUBLIC_URL, expires_in: 300 },
      }),
    )
    await page.route(MOCK_UPLOAD_URL, (route) => route.fulfill({ status: 200, body: '' }))
    await page.goto('/items/publish')
  })

  test('shows preview and enables submit after a valid image is uploaded', async ({ page }) => {
    await page.locator('#publish-photo').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    })

    await expect(page.getByRole('img', { name: 'Photo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Replace photo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish item' })).toBeEnabled()
  })

  test('shows inline error and keeps submit disabled for a non-image file', async ({ page }) => {
    await page.locator('#publish-photo').setInputFiles({
      name: 'doc.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    })

    await expect(page.getByText('Please choose a JPEG, PNG, or WEBP image.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish item' })).toBeDisabled()
  })

  test('shows error when the S3 upload fails', async ({ page }) => {
    // Last-registered route wins — overrides the beforeEach 200 with a 500 for this test only.
    await page.route(MOCK_UPLOAD_URL, (route) => route.fulfill({ status: 500, body: '' }))

    await page.locator('#publish-photo').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    })

    await expect(page.getByText('Upload failed. Please try again.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish item' })).toBeDisabled()
  })
})
