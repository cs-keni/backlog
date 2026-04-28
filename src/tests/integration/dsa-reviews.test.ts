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

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { PATCH } from '@/app/api/dsa/reviews/[id]/route'

const TEST_USER = { id: 'user-1' }
const TEST_REVIEW_ID = 'review-1'

function makeRequest(): Request {
  return new Request(`http://localhost/api/dsa/reviews/${TEST_REVIEW_ID}`, { method: 'PATCH' })
}

describe('PATCH /api/dsa/reviews/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated request', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await PATCH(makeRequest(), { params: Promise.resolve({ id: TEST_REVIEW_ID }) })
    expect(res.status).toBe(401)
  })

  it('sets completed_at and returns the updated review', async () => {
    const now = new Date().toISOString()
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TEST_REVIEW_ID, completed_at: now },
                error: null,
              }),
            }),
          }),
        }),
      }),
    })

    const res = await PATCH(makeRequest(), { params: Promise.resolve({ id: TEST_REVIEW_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completed_at).toBeDefined()
  })

  it('only updates reviews owned by the requesting user (eq user_id check)', async () => {
    // Route chain: .update().eq('id', id).eq('user_id', user.id).select().single()
    let capturedUserId: unknown
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((col: string, val: unknown) => {
            if (col === 'user_id') capturedUserId = val
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: TEST_REVIEW_ID, completed_at: new Date().toISOString() },
                  error: null,
                }),
              }),
            }
          }),
        }),
      }),
    })

    await PATCH(makeRequest(), { params: Promise.resolve({ id: TEST_REVIEW_ID }) })
    expect(capturedUserId).toBe(TEST_USER.id)
  })
})
