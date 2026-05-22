import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabase, mockGetUser } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  return {
    mockSupabase: { auth: { getUser: mockGetUser } },
    mockGetUser,
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { GET } from '@/app/api/prep/question-bank/route'

describe('GET /api/prep/question-bank', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await GET(new Request('http://localhost/api/prep/question-bank?bank=system-design'))

    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid bank', async () => {
    const res = await GET(new Request('http://localhost/api/prep/question-bank?bank=dsa'))

    expect(res.status).toBe(400)
  })

  it('returns system design questions, primers, and cache headers', async () => {
    const res = await GET(new Request('http://localhost/api/prep/question-bank?bank=system-design'))
    const body = await res.json() as { questions: unknown[]; primers: unknown[] }

    expect(res.status).toBe(200)
    expect(body.questions).toHaveLength(70)
    expect(body.primers.length).toBeGreaterThan(0)
    expect(res.headers.get('cache-control')).toContain('max-age=3600')
  })
})
