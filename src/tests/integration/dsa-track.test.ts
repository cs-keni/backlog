import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabase, mockGetUser, mockFrom } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  return {
    mockSupabase: { auth: { getUser: mockGetUser }, from: mockFrom },
    mockGetUser,
    mockFrom,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { PATCH } from '@/app/api/dsa/track/route'

const TEST_USER = { id: 'user-1' }

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/dsa/track', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/dsa/track', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await PATCH(makeRequest({ track: '75' }))

    expect(res.status).toBe(401)
  })

  it('rejects invalid tracks', async () => {
    const res = await PATCH(makeRequest({ track: '500' }))

    expect(res.status).toBe(400)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('updates the authenticated user track', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockFrom.mockReturnValueOnce({ update })

    const res = await PATCH(makeRequest({ track: '75' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ track: '75' })
    expect(mockFrom).toHaveBeenCalledWith('users')
    expect(update).toHaveBeenCalledWith({ dsa_track: '75' })
  })
})
