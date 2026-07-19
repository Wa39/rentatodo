import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@rentatodo.dev')
  await page.getByLabel('Password').fill('Rentatodo2026!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/dashboard')
})

test('requests page shows status tabs', async ({ page }) => {
  await page.goto('/requests')
  await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Active' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'History' })).toBeVisible()
})
