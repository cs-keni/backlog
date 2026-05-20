import type { BrowserContext } from '@playwright/test'

const E2E_AUTH_COOKIE = 'backlog_e2e_user'

export async function authenticateE2E(context: BrowserContext) {
  await context.addCookies([
    {
      name: E2E_AUTH_COOKIE,
      value: '1',
      url: 'http://localhost:3000',
      sameSite: 'Lax',
      secure: false,
      httpOnly: false,
    },
  ])
}
