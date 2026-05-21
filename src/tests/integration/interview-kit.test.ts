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

vi.mock('@anthropic-ai/sdk', () => {
  const mockStreamEvents = [
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Generated brief' } },
  ]
  const mockStream = {
    async *[Symbol.asyncIterator]() {
      for (const event of mockStreamEvents) yield event
    },
  }
  // Use a plain function for stream (not vi.fn) so vi.resetAllMocks() doesn't clear it.
  // The anthropic instance is module-level in route.ts and only constructed once.
  function MockAnthropic() {
    return { messages: { stream: () => mockStream } }
  }
  return { default: MockAnthropic }
})

import { createClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/prep/interview-kit/route'

const TEST_USER = { id: 'user-1' }

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/prep/interview-kit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/prep/interview-kit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await POST(makeRequest({ application_id: 'app-1' }))

    expect(res.status).toBe(401)
  })

  it('streams a generated interview kit for an owned application', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'app-1',
                  job_id: 'job-1',
                  jobs: {
                    title: 'Software Engineer',
                    company: 'Acme',
                    description: null,
                    company_profiles: { description: null },
                  },
                },
                error: null,
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { full_name: 'Kenny', years_of_experience: 3, skills: ['React'] },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      })

    const res = await POST(makeRequest({ application_id: 'app-1' }))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    await expect(res.text()).resolves.toContain('Generated brief')
  })
})
