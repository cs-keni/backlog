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
import { GET, POST } from '@/app/api/dsa/solves/route'

const TEST_USER = { id: 'user-1' }
const TEST_SOLVE_ID = 'solve-1'

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/dsa/solves', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const VALID_BODY = {
  problem_slug: 'two-sum',
  problem_title: 'Two Sum',
  pattern: 'Arrays & Hashing',
  difficulty: 'easy',
  solved_at: '2026-01-10',
}

describe('POST /api/dsa/solves', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated request', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await POST(makeRequest('POST', VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await POST(makeRequest('POST', { problem_slug: 'two-sum' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid difficulty', async () => {
    const res = await POST(makeRequest('POST', { ...VALID_BODY, difficulty: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('creates solve and inserts 5 review rows for a new problem', async () => {
    // No existing solve
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    })
    // Upsert solve
    mockFrom.mockReturnValueOnce({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: TEST_SOLVE_ID }, error: null }),
        }),
      }),
    })
    // Insert reviews
    const insertReviews = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValueOnce({ insert: insertReviews })

    const res = await POST(makeRequest('POST', VALID_BODY))
    expect(res.status).toBe(201)

    const insertedRows: { scheduled_for: string }[] = insertReviews.mock.calls[0][0]
    expect(insertedRows).toHaveLength(5)
    expect(insertedRows[0].scheduled_for).toBe('2026-01-10') // day 0
    expect(insertedRows[1].scheduled_for).toBe('2026-01-11') // +1
    expect(insertedRows[2].scheduled_for).toBe('2026-01-13') // +3
    expect(insertedRows[3].scheduled_for).toBe('2026-01-17') // +7
    expect(insertedRows[4].scheduled_for).toBe('2026-01-24') // +14
  })

  it('deletes pending reviews before re-solve and creates fresh chain', async () => {
    // Existing solve found
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: TEST_SOLVE_ID } }),
          }),
        }),
      }),
    })
    // Delete pending reviews — chain is .delete().eq('solve_id', ...).is('completed_at', null)
    const deletePending = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: deletePending,
        }),
      }),
    })
    // Upsert solve
    mockFrom.mockReturnValueOnce({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: TEST_SOLVE_ID }, error: null }),
        }),
      }),
    })
    // Insert new reviews
    const insertReviews = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValueOnce({ insert: insertReviews })

    const res = await POST(makeRequest('POST', VALID_BODY))
    expect(res.status).toBe(201)
    expect(deletePending).toHaveBeenCalledTimes(1)
    expect(insertReviews.mock.calls[0][0]).toHaveLength(5)
  })
})

describe('GET /api/dsa/solves', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated request', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns solves with nested reviews', async () => {
    const mockData = [
      {
        id: TEST_SOLVE_ID,
        problem_slug: 'two-sum',
        lc_reviews: [{ id: 'rev-1', scheduled_for: '2026-01-10', completed_at: null }],
      },
    ]
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].lc_reviews).toHaveLength(1)
  })
})
