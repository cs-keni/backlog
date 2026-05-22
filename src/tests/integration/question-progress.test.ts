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
import { GET, POST } from '@/app/api/prep/question-progress/route'

const TEST_USER = { id: 'user-1' }

function postRequest(body: unknown) {
  return new Request('http://localhost/api/prep/question-progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/prep/question-progress', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('GET returns rows for the authenticated user', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ question_id: 'sd-001', status: 'studied' }], error: null }),
      }),
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
  })

  it('POST returns 400 for invalid fields', async () => {
    const res = await POST(postRequest({ question_id: 'sd-001', bank: 'system-design', status: 'done' }))

    expect(res.status).toBe(400)
  })

  it('upserts studied progress and creates the first prep review', async () => {
    const reviewInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom
      .mockReturnValueOnce({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'progress-1', question_id: 'sd-001', bank: 'system-design', status: 'studied' },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ insert: reviewInsert })

    const res = await POST(postRequest({ question_id: 'sd-001', bank: 'system-design', status: 'studied' }))

    expect(res.status).toBe(200)
    expect(reviewInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: TEST_USER.id,
      question_id: 'sd-001',
      next_review_at: expect.any(String),
    }))
  })
})
