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
import { POST } from '@/app/api/jobs/feedback/route'

const TEST_USER = { id: 'user-1' }

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/jobs/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/jobs/feedback', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await POST(makeRequest({ job_id: 'job-1', reason: 'too_far' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing job_id', async () => {
    const res = await POST(makeRequest({ reason: 'too_far' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid reason', async () => {
    const res = await POST(makeRequest({ job_id: 'job-1', reason: 'totally_made_up' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing reason', async () => {
    const res = await POST(makeRequest({ job_id: 'job-1' }))
    expect(res.status).toBe(400)
  })

  it.each([
    'not_my_level',
    'too_far',
    'wrong_stack',
    'company_culture',
    'other',
  ] as const)('accepts valid reason "%s"', async (reason) => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValueOnce({ upsert: upsertMock })

    const res = await POST(makeRequest({ job_id: 'job-1', reason }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: TEST_USER.id, job_id: 'job-1', reason },
      { onConflict: 'user_id,job_id' }
    )
  })

  it('returns 500 when upsert fails', async () => {
    mockFrom.mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValue({ error: { message: 'db error' } }),
    })
    const res = await POST(makeRequest({ job_id: 'job-1', reason: 'too_far' }))
    expect(res.status).toBe(500)
  })
})
