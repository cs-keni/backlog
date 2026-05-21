import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabase, mockGetUser, mockFrom, mockBuildStarResponse } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockBuildStarResponse = vi.fn()
  return {
    mockSupabase: { auth: { getUser: mockGetUser }, from: mockFrom },
    mockGetUser,
    mockFrom,
    mockBuildStarResponse,
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/llm/star-builder', () => ({
  buildStarResponse: mockBuildStarResponse,
}))

import { createClient } from '@/lib/supabase/server'
import { GET, POST } from '@/app/api/star-responses/route'
import { PATCH } from '@/app/api/star-responses/[id]/route'

const TEST_USER = { id: 'user-1', email: 'test@example.com' }
const OTHER_USER = { id: 'user-2', email: 'other@example.com' }

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
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

function selectEqOrderEq(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data, error: null }),
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

function selectEqOrderWork(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function insertSingle(row: Record<string, unknown>) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: row, error: null }),
      }),
    }),
  }
}

function ownerSelect(userId: string | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(
          userId ? { data: { user_id: userId }, error: null } : { data: null, error: { message: 'not found' } }
        ),
      }),
    }),
  }
}

describe('star-responses routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
    mockBuildStarResponse.mockResolvedValue({
      situation: 'S',
      task: 'T',
      action: 'A',
      result: 'R',
      full_response: 'Full STAR',
    })
  })

  it('GET returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await GET(new Request('http://localhost/api/star-responses'))

    expect(res.status).toBe(401)
  })

  it('GET returns all responses for user', async () => {
    const rows = [{ id: 'star-1', question: 'Tell me about impact' }]
    mockFrom.mockReturnValueOnce(selectEqOrder(rows))

    const res = await GET(new Request('http://localhost/api/star-responses'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(rows)
  })

  it('GET filters by company_id when provided', async () => {
    const rows = [{ id: 'star-1', company_id: 'company-1' }]
    mockFrom.mockReturnValueOnce(selectEqOrderEq(rows))

    const res = await GET(new Request('http://localhost/api/star-responses?company_id=company-1'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(rows)
  })

  it('POST returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await POST(jsonRequest('http://localhost/api/star-responses', { question: 'Q' }))

    expect(res.status).toBe(401)
  })

  it('POST returns 400 when question is missing', async () => {
    const res = await POST(jsonRequest('http://localhost/api/star-responses', {}))

    expect(res.status).toBe(400)
  })

  it('POST saves without LLM when generate is falsy', async () => {
    const row = { id: 'star-1', question: 'Q', situation: null, task: null, action: null, result: null, full_response: null }
    mockFrom.mockReturnValueOnce(insertSingle(row))

    const res = await POST(jsonRequest('http://localhost/api/star-responses', { question: 'Q' }))

    expect(res.status).toBe(200)
    expect(mockBuildStarResponse).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual(row)
  })

  it('POST calls LLM and saves when generate is true', async () => {
    const row = { id: 'star-1', question: 'Q', situation: 'S', task: 'T', action: 'A', result: 'R', full_response: 'Full STAR' }
    mockFrom
      .mockReturnValueOnce(selectEqSingle({ full_name: 'Kenny', skills: ['React'] }))
      .mockReturnValueOnce(selectEqOrderWork([]))
      .mockReturnValueOnce(insertSingle(row))

    const res = await POST(jsonRequest('http://localhost/api/star-responses', { question: 'Q', generate: true }))

    expect(res.status).toBe(200)
    expect(mockBuildStarResponse).toHaveBeenCalled()
    await expect(res.json()).resolves.toMatchObject({ situation: 'S', task: 'T', action: 'A', result: 'R' })
  })

  it('PATCH returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await PATCH(jsonRequest('http://localhost/api/star-responses/star-1', { situation: 'S' }), {
      params: Promise.resolve({ id: 'star-1' }),
    })

    expect(res.status).toBe(401)
  })

  it('PATCH returns 403 for non-owner row', async () => {
    mockFrom.mockReturnValueOnce(ownerSelect(OTHER_USER.id))

    const res = await PATCH(jsonRequest('http://localhost/api/star-responses/star-1', { situation: 'S' }), {
      params: Promise.resolve({ id: 'star-1' }),
    })

    expect(res.status).toBe(403)
  })

  it('PATCH updates owner row', async () => {
    const updated = {
      id: 'star-1',
      question: 'Q',
      situation: 'S',
      task: 'T',
      action: 'A',
      result: 'R',
      full_response: 'Situation: S\n\nTask: T\n\nAction: A\n\nResult: R',
    }
    mockFrom
      .mockReturnValueOnce(ownerSelect(TEST_USER.id))
      .mockReturnValueOnce({
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

    const res = await PATCH(jsonRequest('http://localhost/api/star-responses/star-1', {
      situation: 'S',
      task: 'T',
      action: 'A',
      result: 'R',
    }), {
      params: Promise.resolve({ id: 'star-1' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(updated)
  })
})
