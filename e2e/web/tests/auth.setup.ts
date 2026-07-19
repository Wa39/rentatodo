import { test as setup } from '@playwright/test'
import path from 'path'

export const authFile = path.join(__dirname, '../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@rentatodo.dev')
  await page.getByLabel('Password').fill('Rentatodo2026!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/dashboard')
  await page.context().storageState({ path: authFile })
})
