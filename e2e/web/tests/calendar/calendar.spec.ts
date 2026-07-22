import { test, expect } from '../fixtures'

test('calendar page shows empty state when owner has no items', async ({ page }) => {
  // GET /users/me/items is mocked to return [] in fixtures.ts
  await page.goto('/requests/calendar')
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
  await expect(
    page.getByText("You don't have any items yet. Publish one to see its calendar."),
  ).toBeVisible()
})
