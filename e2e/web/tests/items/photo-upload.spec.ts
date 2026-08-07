import { test, expect } from '../fixtures'

// Minimal 1×1 transparent PNG (70 bytes, RGBA) — valid IDAT stream so
// createImageBitmap() accepts it in Chromium without mocking the browser API.
const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63606060600000000500017aa857500000000049454e44ae426082',
  'hex',
)

const UPLOAD_URL = 'https://s3.example.com/photos/upload-test'
const PUBLIC_URL = 'https://cdn.rentatodo.com/photos/test.png'

test.describe('PublishItemPage — photo upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/uploads/presign', (route) =>
      route.fulfill({
        json: { upload_url: UPLOAD_URL, public_url: PUBLIC_URL, expires_in: 300 },
      }),
    )
    await page.route(UPLOAD_URL, (route) => route.fulfill({ status: 200, body: '' }))
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
    await page.route(UPLOAD_URL, (route) => route.fulfill({ status: 500, body: '' }))

    await page.locator('#publish-photo').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    })

    await expect(page.getByText('Upload failed. Please try again.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish item' })).toBeDisabled()
  })
})
