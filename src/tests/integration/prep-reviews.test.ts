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

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { GET } from '@/app/api/prep/prep-reviews/route'
import { PATCH } from '@/app/api/prep/prep-reviews/[id]/route'

const TEST_USER = { id: 'user-1' }

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/prep/prep-reviews/review-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/prep/prep-reviews', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('GET returns due reviews enriched with static question data', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{
                  id: 'review-1',
                  question_id: 'sd-001',
                  bank: 'system-design',
                  interval_days: 1,
                  next_review_at: '2026-05-22',
                  last_difficulty: null,
                }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    })

    const res = await GET()
    const body = await res.json() as Array<{ question: { prompt: string } }>

    expect(res.status).toBe(200)
    expect(body[0].question.prompt).toContain('caching')
  })

  it('PATCH returns 400 for invalid difficulty', async () => {
    const res = await PATCH(patchRequest({ difficulty: 'medium' }), { params: Promise.resolve({ id: 'review-1' }) })

    expect(res.status).toBe(400)
  })

  it('PATCH returns 403 when the review is not owned by the user', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'review-1', user_id: 'other-user', interval_days: 1 },
            error: null,
          }),
        }),
      }),
    })

    const res = await PATCH(patchRequest({ difficulty: 'easy' }), { params: Promise.resolve({ id: 'review-1' }) })

    expect(res.status).toBe(403)
  })

  it('PATCH updates interval and next review date', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'review-1', interval_days: 3, next_review_at: '2026-05-25', last_difficulty: 'easy' },
              error: null,
            }),
          }),
        }),
      }),
    })

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'review-1', user_id: TEST_USER.id, interval_days: 1 },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ update: updateMock })

    const res = await PATCH(patchRequest({ difficulty: 'easy' }), { params: Promise.resolve({ id: 'review-1' }) })

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      interval_days: 3,
      last_difficulty: 'easy',
    }))
  })
})
