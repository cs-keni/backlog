import { test, expect } from '@playwright/test'
import { authenticateE2E } from './helpers'

test.describe('Tracker bulk actions', () => {
  test('archives multiple selected applications', async ({ page, context }) => {
    await authenticateE2E(context)

    await page.goto('/tracker')

    await page.getByRole('button', { name: 'Select' }).click()
    await page.getByTestId('application-card-e2e-app-1').click({ force: true })
    await page.getByTestId('application-card-e2e-app-2').click({ force: true })
    await page.getByTestId('application-card-e2e-app-3').click({ force: true })

    await expect(page.getByRole('toolbar', { name: 'Bulk actions' }).getByText('3 selected')).toBeVisible()
    await page.getByRole('button', { name: 'Archive 3 selected applications' }).click()

    await expect(page.getByText('Archived 3 applications')).toBeVisible()
    await expect(page.getByRole('button', { name: /Show archived \(3\)/ })).toBeVisible()
  })

  test('keeps bulk actions hidden until at least one card is selected', async ({ page, context }) => {
    await authenticateE2E(context)

    await page.goto('/tracker')

    await expect(page.getByTestId('application-card-e2e-app-1')).toBeVisible()
    await expect(page.getByTestId('application-card-e2e-app-2')).toBeVisible()
    await expect(page.getByRole('toolbar', { name: 'Bulk actions' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Select' }).click()

    await expect(page.getByRole('button', { name: 'Cancel · 0 selected' })).toBeVisible()
    await expect(page.getByRole('toolbar', { name: 'Bulk actions' })).toHaveCount(0)
    await expect(page.getByText('Frontend Platform Engineer')).toBeVisible()

    await page.getByRole('button', { name: 'Cancel · 0 selected' }).click()

    await expect(page.getByRole('button', { name: 'Select' })).toBeVisible()
  })
})
