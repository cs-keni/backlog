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
import { GET, POST } from '@/app/api/story-bank/route'

const TEST_USER = { id: 'user-1', email: 'test@example.com' }

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/story-bank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const BASE_STORY = {
  title: 'Led migration project',
  theme: 'Leadership',
  situation: 'Our team needed to migrate a legacy system.',
  task: 'I was responsible for planning the migration.',
  action: 'I broke the work into phases and led weekly syncs.',
  result: 'We migrated on time with zero downtime.',
  reflection: 'Learned to communicate proactively.',
}

describe('GET /api/story-bank', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReset()
    mockGetUser.mockReset()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns own rows ordered by created_at desc', async () => {
    const rows = [{ id: '1', title: 'Story A', user_id: TEST_USER.id }]
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(rows)
  })

  it('returns 401 for unauthenticated request', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })
})

describe('POST /api/story-bank', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReset()
    mockGetUser.mockReset()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('creates row with valid tags array', async () => {
    let captured: Record<string, unknown> | undefined
    mockFrom.mockReturnValue({
      insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        captured = data
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: '1', ...data }, error: null }),
          }),
        }
      }),
    })
    const res = await POST(makePostRequest({ ...BASE_STORY, tags: ['leadership', 'migration'] }))
    expect(res.status).toBe(201)
    expect(captured?.tags).toEqual(['leadership', 'migration'])
  })

  it('coerces non-array tags to empty array (not stored as string)', async () => {
    let captured: Record<string, unknown> | undefined
    mockFrom.mockReturnValue({
      insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        captured = data
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: '1', ...data }, error: null }),
          }),
        }
      }),
    })
    const res = await POST(makePostRequest({ ...BASE_STORY, tags: 'not-an-array' }))
    expect(res.status).toBe(201)
    expect(captured?.tags).toEqual([])
  })

  it('filters non-string values out of tags array', async () => {
    let captured: Record<string, unknown> | undefined
    mockFrom.mockReturnValue({
      insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        captured = data
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: '1', ...data }, error: null }),
          }),
        }
      }),
    })
    const res = await POST(makePostRequest({ ...BASE_STORY, tags: ['valid', 123, null, 'also-valid'] }))
    expect(res.status).toBe(201)
    expect(captured?.tags).toEqual(['valid', 'also-valid'])
  })

  it('returns 400 when title is missing', async () => {
    const res = await POST(makePostRequest({ theme: 'Leadership' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when theme is missing', async () => {
    const res = await POST(makePostRequest({ title: 'A story' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 for unauthenticated request', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await POST(makePostRequest(BASE_STORY))
    expect(res.status).toBe(401)
  })
})
