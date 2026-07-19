import { test, expect } from '../fixtures'

test('happy-path login redirects to dashboard', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  await page.getByLabel('Email').fill('owner@rentatodo.dev')
  await page.getByLabel('Password').fill('Rentatodo2026!')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
})

test('unauthenticated visit to /dashboard redirects to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('unauthenticated visit to / redirects to login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/login')
})
