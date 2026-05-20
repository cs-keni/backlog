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

function makeRequest(body?: object): Request {
  return new Request(`http://localhost/api/dsa/reviews/${TEST_REVIEW_ID}`, {
    method: 'PATCH',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
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

  it('marks with difficulty=easy, creates next review 3 days out (from interval=1)', async () => {
    // Current review has scheduled_for 1 day after previous → currentInterval=1 → easy → nextInterval=3
    const currentScheduled = '2026-05-20'
    const prevScheduled = '2026-05-19'

    // 1. Fetch current review
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: TEST_REVIEW_ID, solve_id: 'solve-1', scheduled_for: currentScheduled },
              error: null,
            }),
          }),
        }),
      }),
    })
    // 2. Previous completed reviews for this solve
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [{ scheduled_for: prevScheduled }] }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
    // 3. Update current review
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TEST_REVIEW_ID, completed_at: new Date().toISOString(), difficulty: 'easy' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    })
    // 4. Insert next review
    const reviewInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValueOnce({ insert: reviewInsert })

    const res = await PATCH(makeRequest({ difficulty: 'easy' }), { params: Promise.resolve({ id: TEST_REVIEW_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { next_scheduled_for: string }
    expect(body.next_scheduled_for).toBeDefined()
    expect(reviewInsert).toHaveBeenCalledWith(expect.objectContaining({ solve_id: 'solve-1' }))
  })

  it('marks with difficulty=hard, creates next review 1 day out regardless of interval', async () => {
    // Current review with interval=14 days from previous → hard → nextInterval=1
    const currentScheduled = '2026-05-20'
    const prevScheduled = '2026-05-06'

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: TEST_REVIEW_ID, solve_id: 'solve-1', scheduled_for: currentScheduled },
              error: null,
            }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [{ scheduled_for: prevScheduled }] }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TEST_REVIEW_ID, completed_at: new Date().toISOString(), difficulty: 'hard' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    })
    const reviewInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValueOnce({ insert: reviewInsert })

    const res = await PATCH(makeRequest({ difficulty: 'hard' }), { params: Promise.resolve({ id: TEST_REVIEW_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { next_scheduled_for: string; difficulty: string }
    expect(body.difficulty).toBe('hard')
    // Hard always schedules 1 day from today
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const expectedDate = tomorrow.toLocaleDateString('en-CA')
    expect(body.next_scheduled_for).toBe(expectedDate)
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
