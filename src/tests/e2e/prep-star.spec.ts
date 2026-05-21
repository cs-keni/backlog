import { test, expect } from '@playwright/test'
import { authenticateE2E } from './helpers'
import { mockLlmEndpoints } from './fixtures/llm-mock'

test.describe('Interview prep STAR drafting', () => {
  test('generates and saves a STAR response from a prep question', async ({ page, context }) => {
    await authenticateE2E(context)
    await mockLlmEndpoints(page)

    await page.goto('/prep?job_id=e2e-job-1')

    await expect(page.getByRole('heading', { name: 'Frontend Platform Engineer' })).toBeVisible()
    await expect(page.getByText('Interview Intelligence')).toBeVisible()
    await expect(page.getByText('Make every operations team faster')).toBeVisible()
    await expect(page.getByText('Fleet OS')).toBeVisible()
    await expect(page.getByText('Warehouse Twin')).toBeVisible()

    await page.getByRole('button', { name: /Draft/ }).first().click()
    await page.getByRole('button', { name: 'Draft response with Claude' }).click()

    await expect(page.locator('textarea').first()).toHaveValue(/shared dashboard component/)
    await page.getByRole('button', { name: 'Save response' }).click()
    await expect(page.getByText('Saved!')).toBeVisible()
  })

  test('surfaces the refresh cooldown for recently enriched company data', async ({ page, context }) => {
    await authenticateE2E(context)
    await mockLlmEndpoints(page)

    await page.goto('/prep?job_id=e2e-job-1')

    await expect(page.getByText('Acme Robotics').first()).toBeVisible()
    await expect(page.getByText('Fleet OS')).toBeVisible()
    await expect(page.getByText('TypeScript')).toBeVisible()
    await page.getByRole('button', { name: 'Refresh company data' }).click()

    await expect(page.getByText('Company data was refreshed recently - try again tomorrow')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh company data' })).toBeEnabled()
  })
})
