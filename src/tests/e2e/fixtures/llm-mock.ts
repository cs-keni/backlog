import type { Page } from '@playwright/test'

export async function mockLlmEndpoints(page: Page) {
  await page.route('**/api/star-responses', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    const body = route.request().postDataJSON() as { question?: string } | null
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-star-route-mock',
        user_id: 'e2e-user-1',
        company_id: 'e2e-company-1',
        question: body?.question ?? 'Tell me about a frontend systems project.',
        situation: 'A shared dashboard component was duplicated across product teams.',
        task: 'I needed to consolidate behavior while preserving delivery velocity.',
        action: 'I shipped a compatible primitive, migrated one workflow, and documented examples.',
        result: 'The team reused the primitive in follow-up dashboard work with fewer regressions.',
        full_response: 'Situation: A shared dashboard component was duplicated across product teams.',
        created_at: '2026-05-20T16:00:00.000Z',
        updated_at: '2026-05-20T16:00:00.000Z',
      }),
    })
  })

  await page.route('**/api/cover-letter**', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'e2e-cover-letter-1', template_type: 'standard', created_at: '2026-05-20T16:00:00.000Z' }),
    })
  })
}
