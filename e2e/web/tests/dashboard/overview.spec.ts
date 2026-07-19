import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@rentatodo.dev')
  await page.getByLabel('Password').fill('Rentatodo2026!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/dashboard')
})

test('dashboard overview shows KPI cards', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByText('Active items')).toBeVisible()
  await expect(page.getByText('Pending requests')).toBeVisible()
})

test('sidebar navigation links are present', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'My items' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Requests' })).toBeVisible()
})
