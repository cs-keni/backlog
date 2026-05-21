import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabase, mockGetUser, mockFrom, mockGenerateCoverLetter } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockGenerateCoverLetter = vi.fn()
  return {
    mockSupabase: { auth: { getUser: mockGetUser }, from: mockFrom },
    mockGetUser,
    mockFrom,
    mockGenerateCoverLetter,
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/llm/cover-letter', () => ({
  generateCoverLetter: mockGenerateCoverLetter,
}))

import { createClient } from '@/lib/supabase/server'
import { GET, POST } from '@/app/api/cover-letter/route'
import { PATCH } from '@/app/api/cover-letter/[id]/route'

const TEST_USER = { id: 'user-1', email: 'test@example.com' }

function request(url: string, body?: unknown): Request {
  return new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function selectEqEqMaybeSingle(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  }
}

function selectEqSingle(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function selectEqOrder(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function selectEqEqOrderLimitMaybeSingle(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
            }),
          }),
        }),
      }),
    }),
  }
}

function selectEqOrderLimitMaybeSingle(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    }),
  }
}

describe('cover-letter routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
    mockGenerateCoverLetter.mockResolvedValue({
      template_type: 'formal',
      content: 'Generated cover letter content.',
    })
  })

  it('GET returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await GET(new Request('http://localhost/api/cover-letter?job_id=job-1'))

    expect(res.status).toBe(401)
  })

  it('GET returns 400 when job_id is missing', async () => {
    const res = await GET(new Request('http://localhost/api/cover-letter'))

    expect(res.status).toBe(400)
  })

  it('GET returns null when no application exists for the job', async () => {
    mockFrom.mockReturnValueOnce(selectEqEqMaybeSingle(null))

    const res = await GET(new Request('http://localhost/api/cover-letter?job_id=job-1'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toBeNull()
  })

  it('GET returns an existing cover letter', async () => {
    const cover = { id: 'cover-1', template_type: 'formal', content: 'Existing', created_at: '2026-05-21T00:00:00Z' }
    mockFrom
      .mockReturnValueOnce(selectEqEqMaybeSingle({ id: 'app-1' }))
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: cover, error: null }),
              }),
            }),
          }),
        }),
      })

    const res = await GET(new Request('http://localhost/api/cover-letter?job_id=job-1'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(cover)
  })

  it('POST returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await POST(request('http://localhost/api/cover-letter', { job_id: 'job-1' }))

    expect(res.status).toBe(401)
  })

  it('POST returns 400 when job_id is missing', async () => {
    const res = await POST(request('http://localhost/api/cover-letter', {}))

    expect(res.status).toBe(400)
  })

  it('POST returns 400 when resume_text is missing or too short', async () => {
    mockFrom
      .mockReturnValueOnce(selectEqSingle({ resume_text: 'short' }))
      .mockReturnValueOnce(selectEqOrder([]))
      .mockReturnValueOnce(selectEqSingle({ id: 'job-1', title: 'Engineer', company: 'Acme', description: null, tags: [] }))
      .mockReturnValueOnce(selectEqOrder([]))

    const res = await POST(request('http://localhost/api/cover-letter', { job_id: 'job-1' }))

    expect(res.status).toBe(400)
  })

  it('POST generates and saves a cover letter for an existing application', async () => {
    mockFrom
      .mockReturnValueOnce(selectEqSingle({
        full_name: 'Kenny',
        email: 'test@example.com',
        skills: ['React'],
        resume_text: 'A'.repeat(120),
      }))
      .mockReturnValueOnce(selectEqOrder([]))
      .mockReturnValueOnce(selectEqSingle({ id: 'job-1', title: 'Engineer', company: 'Acme', description: 'Build UI', tags: [] }))
      .mockReturnValueOnce(selectEqOrder([]))
      .mockReturnValueOnce(selectEqEqMaybeSingle({ id: 'app-1', status: 'saved' }))
      .mockReturnValueOnce(selectEqOrderLimitMaybeSingle(null))
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'cover-1' }, error: null }),
          }),
        }),
      })

    const res = await POST(request('http://localhost/api/cover-letter', { job_id: 'job-1' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      id: 'cover-1',
      template_type: 'formal',
      content: 'Generated cover letter content.',
      application_id: 'app-1',
    })
  })

  it('PATCH returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await PATCH(request('http://localhost/api/cover-letter/cover-1', { content: 'Updated' }), {
      params: Promise.resolve({ id: 'cover-1' }),
    })

    expect(res.status).toBe(401)
  })

  it('PATCH returns 400 when no valid fields are provided', async () => {
    const res = await PATCH(request('http://localhost/api/cover-letter/cover-1', { template_type: 'bad' }), {
      params: Promise.resolve({ id: 'cover-1' }),
    })

    expect(res.status).toBe(400)
  })

  it('PATCH updates content for an owner row', async () => {
    const updated = { id: 'cover-1', template_type: 'formal', content: 'Updated content' }
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updated, error: null }),
            }),
          }),
        }),
      }),
    })

    const res = await PATCH(request('http://localhost/api/cover-letter/cover-1', { content: 'Updated content' }), {
      params: Promise.resolve({ id: 'cover-1' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(updated)
  })
})
