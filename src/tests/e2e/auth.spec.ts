import { test, expect } from '@playwright/test'

test.describe('Auth — unauthenticated redirects', () => {
  test('visiting /feed while unauthenticated redirects to /login', async ({
    page,
  }) => {
    // Navigate to the protected feed route without any session cookie
    await page.goto('/feed')

    // Should be redirected to /login
    await expect(page).toHaveURL(/\/login/)

    // Login form should be visible
    await expect(page.getByRole('heading', { name: /backlog/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('visiting / while unauthenticated redirects to /login', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})
