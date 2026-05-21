import { test, expect } from '@playwright/test'
import { authenticateE2E } from './helpers'

test.describe('Tracker drag workflow', () => {
  test('moves an application between kanban columns', async ({ page, context }) => {
    await authenticateE2E(context)

    await page.goto('/tracker')

    const card = page.getByTestId('application-card-e2e-app-1')
    await expect(card).toBeVisible()

    const technicalColumn = page.getByTestId('tracker-column-technical')
    const source = await card.boundingBox()
    const target = await technicalColumn.boundingBox()
    if (!source || !target) throw new Error('Could not measure drag source or target')

    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x + target.width / 2, target.y + 40, { steps: 12 })
    await page.mouse.up()

    await expect(page.getByText('Moved to Technical')).toBeVisible()
    await expect(technicalColumn.getByText('Frontend Platform Engineer')).toBeVisible()
  })

  test('does not move a card when dropped back on the same column', async ({ page, context }) => {
    await authenticateE2E(context)

    await page.goto('/tracker')

    const savedColumn = page.getByTestId('tracker-column-saved')
    const card = page.getByTestId('application-card-e2e-app-1')
    await expect(savedColumn.getByText('Frontend Platform Engineer')).toBeVisible()

    const source = await card.boundingBox()
    const target = await savedColumn.boundingBox()
    if (!source || !target) throw new Error('Could not measure drag source or target')

    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x + target.width / 2, target.y + 40, { steps: 12 })
    await page.mouse.up()

    await expect(page.getByText(/Moved to/)).toHaveCount(0)
    await expect(savedColumn.getByText('Frontend Platform Engineer')).toBeVisible()
  })
})
