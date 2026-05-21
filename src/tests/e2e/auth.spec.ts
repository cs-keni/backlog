import { test, expect } from '@playwright/test'
import { authenticateE2E } from './helpers'

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

  test('visiting /tracker while unauthenticated redirects to /login', async ({
    page,
  }) => {
    await page.goto('/tracker')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByLabel(/email/i)).toBeVisible()
  })
})

test.describe('Auth — authenticated access', () => {
  test('visiting /feed with an e2e session renders the app route', async ({
    page,
    context,
  }) => {
    await authenticateE2E(context)

    await page.goto('/feed')

    await expect(page).toHaveURL(/\/feed/)
    await expect(page.getByRole('heading', { name: 'Job Feed' })).toBeVisible()
  })

  test('visiting /tracker with an e2e session renders the kanban board', async ({
    page,
    context,
  }) => {
    await authenticateE2E(context)

    await page.goto('/tracker')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/tracker/)
    await expect(page.getByTestId('tracker-column-saved')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select' })).toBeVisible()
  })

  test('visiting /prep with an e2e session renders the prep page', async ({
    page,
    context,
  }) => {
    await authenticateE2E(context)

    await page.goto('/prep?job_id=e2e-job-1')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/prep/)
    await expect(page.getByRole('heading', { name: 'Frontend Platform Engineer' })).toBeVisible()
  })
})
