import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabase, mockGetUser, mockFrom, mockCreate } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockCreate = vi.fn()
  return {
    mockSupabase: { auth: { getUser: mockGetUser }, from: mockFrom },
    mockGetUser,
    mockFrom,
    mockCreate,
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => {
  function MockAnthropic() {
    return { messages: { create: mockCreate } }
  }
  return { default: MockAnthropic }
})

import { createClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/prep/prep-practice/route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/prep/prep-practice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/prep/prep-practice', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: { id: `user-${Math.random()}` } } })
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          scores: { requirements: 7, capacity: 6, components: 8, bottlenecks: 5, tradeoffs: 7 },
          overall: 'Good structure; add capacity math.',
        }),
      }],
    })
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await POST(makeRequest({ question_id: 'sd-001', bank: 'system-design', response_text: 'answer' }))

    expect(res.status).toBe(401)
  })

  it('validates response length', async () => {
    const res = await POST(makeRequest({
      question_id: 'sd-001',
      bank: 'system-design',
      response_text: 'x'.repeat(5001),
    }))

    expect(res.status).toBe(400)
  })

  it('evaluates and stores a system design response', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValueOnce({ insert: insertMock })

    const res = await POST(makeRequest({
      question_id: 'sd-001',
      bank: 'system-design',
      response_text: 'I would clarify requirements, estimate traffic, and design cache-aside Redis.',
    }))
    const body = await res.json() as { scores: Record<string, number>; overall: string }

    expect(res.status).toBe(200)
    expect(body.scores.requirements).toBe(7)
    expect(body.overall).toContain('capacity')
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      question_id: 'sd-001',
      scores: expect.objectContaining({ requirements: 7 }),
    }))
  })

  it('returns 422 when the model response is not valid rubric JSON', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'not json' }] })

    const res = await POST(makeRequest({
      question_id: 'sd-001',
      bank: 'system-design',
      response_text: 'answer',
    }))

    expect(res.status).toBe(422)
  })
})
