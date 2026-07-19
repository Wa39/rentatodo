import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@rentatodo.dev')
  await page.getByLabel('Password').fill('Rentatodo2026!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/dashboard')
})

test('items page shows heading and publish button', async ({ page }) => {
  await page.goto('/items')
  await expect(page.getByRole('heading', { name: 'My items' })).toBeVisible()
  await expect(page.getByRole('link', { name: /publish/i })).toBeVisible()
})

test('publish item page is accessible', async ({ page }) => {
  await page.goto('/items/publish')
  await expect(page).toHaveURL('/items/publish')
})
