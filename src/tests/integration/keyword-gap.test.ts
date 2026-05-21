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

vi.mock('@anthropic-ai/sdk', () => {
  const gapResponse = {
    content: [{ type: 'text', text: '{"skills":["TypeScript"],"tools":["Docker"],"verbs":["optimized"]}' }],
  }
  // Use plain function (not vi.fn) so vi.resetAllMocks() doesn't wipe it.
  function MockAnthropic() {
    return {
      messages: {
        create: () => Promise.resolve(gapResponse),
      },
    }
  }
  return { default: MockAnthropic }
})

import { createClient } from '@/lib/supabase/server'
import { GET, POST } from '@/app/api/prep/keyword-gap/route'

const TEST_USER = { id: 'user-1' }

function makeGetRequest(applicationId = 'app-1') {
  return new Request(`http://localhost/api/prep/keyword-gap?application_id=${applicationId}`)
}

function makePostRequest(body: unknown) {
  return new Request('http://localhost/api/prep/keyword-gap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/prep/keyword-gap', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns 400 when application_id is missing', async () => {
    const res = await GET(new Request('http://localhost/api/prep/keyword-gap'))
    expect(res.status).toBe(400)
  })

  it('returns null when no cached gaps exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('returns cached gaps when they exist', async () => {
    const cached = { id: 'gap-1', gaps: { skills: ['React'], tools: [], verbs: [] }, generated_at: new Date().toISOString() }
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: cached }),
          }),
        }),
      }),
    })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'gap-1', gaps: { skills: ['React'] } })
  })
})

describe('POST /api/prep/keyword-gap', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await POST(makePostRequest({ application_id: 'app-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is missing application_id', async () => {
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when application not found', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { resume_text: 'resume' }, error: null }),
        }),
      }),
    })
    const res = await POST(makePostRequest({ application_id: 'app-missing' }))
    expect(res.status).toBe(404)
  })

  it('returns 422 when job description or resume is missing', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'app-1', jobs: { description: null } }, error: null }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { resume_text: null }, error: null }),
        }),
      }),
    })
    const res = await POST(makePostRequest({ application_id: 'app-1' }))
    expect(res.status).toBe(422)
  })

  it('calls LLM and upserts gaps on success', async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'gap-1', gaps: { skills: ['TypeScript'], tools: ['Docker'], verbs: ['optimized'] }, generated_at: new Date().toISOString() },
          error: null,
        }),
      }),
    })

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'app-1', jobs: { description: 'We need TypeScript and Docker experience' } },
              error: null,
            }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { resume_text: 'Experienced engineer with React background' }, error: null }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({ upsert: upsertMock })

    const res = await POST(makePostRequest({ application_id: 'app-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ gaps: { skills: ['TypeScript'] } })
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ application_id: 'app-1', user_id: TEST_USER.id }),
      expect.any(Object)
    )
  })
})
