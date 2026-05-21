import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSupabase, mockGetUser, mockFrom } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  return {
    mockSupabase: { auth: { getUser: mockGetUser }, from: mockFrom },
    mockGetUser,
    mockFrom,
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { PUT } from '@/app/api/applications/[id]/ats-platform/route'

const TEST_USER = { id: 'user-1' }

function makeRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/applications/${id}/ats-platform`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function params(id = 'app-1') {
  return { params: Promise.resolve({ id }) }
}

function mockUpdateSingle(data: Record<string, unknown> | null) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data, error: data ? null : { message: 'not found' } }),
          }),
        }),
      }),
    }),
  }
}

describe('PUT /api/applications/[id]/ats-platform', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await PUT(makeRequest('app-1', { ats_platform: 'greenhouse' }), params())
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid platform name', async () => {
    const res = await PUT(makeRequest('app-1', { ats_platform: 'notreal' }), params())
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing ats_platform', async () => {
    const res = await PUT(makeRequest('app-1', {}), params())
    expect(res.status).toBe(400)
  })

  it.each(['greenhouse', 'workday', 'lever', 'ashby', 'icims', 'taleo', 'unknown'] as const)(
    'accepts valid platform "%s"',
    async (platform) => {
      mockFrom.mockReturnValueOnce(
        mockUpdateSingle({ id: 'app-1', ats_platform: platform })
      )
      const res = await PUT(makeRequest('app-1', { ats_platform: platform }), params())
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ id: 'app-1', ats_platform: platform })
    }
  )

  it('returns 404 when application does not belong to the user', async () => {
    mockFrom.mockReturnValueOnce(mockUpdateSingle(null))
    const res = await PUT(makeRequest('app-other', { ats_platform: 'greenhouse' }), params('app-other'))
    expect(res.status).toBe(404)
  })
})
