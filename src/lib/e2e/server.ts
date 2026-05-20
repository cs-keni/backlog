import type { NextRequest } from 'next/server'

export const E2E_AUTH_COOKIE = 'backlog_e2e_user'

export function isE2ETestMode() {
  return process.env.NEXT_PUBLIC_E2E_TEST_MODE === '1'
}

export function hasE2EAuthCookie(request: NextRequest | Request) {
  if (!isE2ETestMode()) return false

  if ('cookies' in request) {
    return request.cookies.get(E2E_AUTH_COOKIE)?.value === '1'
  }

  const cookie = request.headers.get('cookie') ?? ''
  return cookie
    .split(';')
    .map((part) => part.trim())
    .includes(`${E2E_AUTH_COOKIE}=1`)
}
