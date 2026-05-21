import { test, expect } from '@playwright/test'
import { authenticateE2E } from './helpers'

test.describe('Login and feed smoke', () => {
  test('authenticated user can load and filter the feed', async ({ page, context }) => {
    await authenticateE2E(context)

    await page.goto('/feed')

    await expect(page.getByRole('heading', { name: 'Job Feed' })).toBeVisible()
    await expect(page.getByText('Frontend Platform Engineer')).toBeVisible()
    await expect(page.getByText('Acme Robotics')).toBeVisible()

    await page.getByRole('button', { name: 'Salary' }).click()
    await page.keyboard.press('f')
    await expect(page.getByRole('button', { name: 'Salary' })).toBeVisible()

    await page.locator('aside').getByRole('button', { name: 'Remote', exact: true }).click()
    await page.getByPlaceholder(/City/).fill('Remote')

    await expect(page.getByText('Frontend Platform Engineer')).toBeVisible()
    await expect(page.getByText('Backend Integrations Engineer')).toBeHidden()
    await expect(page.locator('aside').getByRole('button', { name: 'clear', exact: true })).toBeVisible()
  })

  test('shows an empty state when filters exclude all jobs', async ({ page, context }) => {
    await authenticateE2E(context)

    await page.goto('/feed')

    await page.getByPlaceholder('Title or company...').fill('zzzz-no-results')

    await expect(page.getByText('No jobs match your filters')).toBeVisible()
    await expect(page.getByText('Frontend Platform Engineer')).toBeHidden()

    await page.getByRole('button', { name: 'Clear filters' }).click()

    await expect(page.getByText('Frontend Platform Engineer')).toBeVisible()
  })
})
