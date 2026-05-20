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
    await page.getByPlaceholder(/City/).fill('Remote')
    await expect(page.getByText('Frontend Platform Engineer')).toBeVisible()
  })
})
