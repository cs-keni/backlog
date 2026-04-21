import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────────────────────
// vi.mock is hoisted, so the factory cannot reference outer variables at definition
// time. We hoist the mock object with vi.hoisted() instead.

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
import { GET as applicationsGET, POST as applicationsPOST } from '@/app/api/applications/route'
import { PATCH as applicationPATCH, DELETE as applicationDELETE } from '@/app/api/applications/[id]/route'

const TEST_USER = { id: 'user-1', email: 'test@example.com' }
const TEST_APP_ID = 'app-1'
const TEST_JOB_ID = 'job-1'

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/applications', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function makeIdRequest(method: string, body?: unknown): Request {
  return new Request(`http://localhost/api/applications/${TEST_APP_ID}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/applications', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReset()
    mockGetUser.mockReset()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('creates row and writes one initial timeline entry for new application', async () => {
    // maybeSingle check → null (no existing)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    })
    // upsert → returns new app
    mockFrom.mockReturnValueOnce({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'saved' }, error: null }),
        }),
      }),
    })
    // timeline insert
    const timelineInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValueOnce({ insert: timelineInsert })

    const res = await applicationsPOST(makeRequest('POST', { job_id: TEST_JOB_ID, status: 'saved' }))
    expect(res.status).toBe(201)
    expect(timelineInsert).toHaveBeenCalledTimes(1)
  })

  it('does NOT write second timeline row for existing application', async () => {
    // maybeSingle → existing found
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'saved' } }),
          }),
        }),
      }),
    })
    // upsert
    mockFrom.mockReturnValueOnce({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'saved' }, error: null }),
        }),
      }),
    })
    const timelineInsert = vi.fn()
    mockFrom.mockReturnValueOnce({ insert: timelineInsert })

    await applicationsPOST(makeRequest('POST', { job_id: TEST_JOB_ID, status: 'saved' }))
    // isNew === false → no timeline insert
    expect(timelineInsert).not.toHaveBeenCalled()
  })

  it('returns 401 for unauthenticated request', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await applicationsPOST(makeRequest('POST', { job_id: TEST_JOB_ID, status: 'saved' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing job_id', async () => {
    const res = await applicationsPOST(makeRequest('POST', { status: 'saved' }))
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/applications/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReset()
    mockGetUser.mockReset()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('stamps applied_at on first transition to "applied"', async () => {
    let capturedUpdates: Record<string, unknown> | undefined
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'saved' }, error: null }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockImplementation((updates: Record<string, unknown>) => {
        capturedUpdates = updates
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'applied', applied_at: new Date().toISOString() }, error: null }),
              }),
            }),
          }),
        }
      }),
    })
    mockFrom.mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({}) })

    await applicationPATCH(makeIdRequest('PATCH', { status: 'applied' }), { params: Promise.resolve({ id: TEST_APP_ID }) })
    expect(capturedUpdates?.applied_at).toBeDefined()
  })

  it('does NOT overwrite applied_at on re-setting status to "applied"', async () => {
    let capturedUpdates: Record<string, unknown> | undefined
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'applied' }, error: null }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockImplementation((updates: Record<string, unknown>) => {
        capturedUpdates = updates
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'applied' }, error: null }),
              }),
            }),
          }),
        }
      }),
    })
    mockFrom.mockReturnValueOnce({ insert: vi.fn() })

    await applicationPATCH(makeIdRequest('PATCH', { status: 'applied' }), { params: Promise.resolve({ id: TEST_APP_ID }) })
    // current.status === 'applied' → applied_at must NOT be set in update payload
    expect(capturedUpdates?.applied_at).toBeUndefined()
  })

  it('writes timeline row when status changes', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'saved' }, error: null }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'applied' }, error: null }),
            }),
          }),
        }),
      }),
    })
    const timelineInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValueOnce({ insert: timelineInsert })

    await applicationPATCH(makeIdRequest('PATCH', { status: 'applied' }), { params: Promise.resolve({ id: TEST_APP_ID }) })
    expect(timelineInsert).toHaveBeenCalledTimes(1)
  })

  it('does NOT write timeline row when status unchanged', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'applied' }, error: null }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'applied' }, error: null }),
            }),
          }),
        }),
      }),
    })
    const timelineInsert = vi.fn()
    mockFrom.mockReturnValueOnce({ insert: timelineInsert })

    await applicationPATCH(makeIdRequest('PATCH', { status: 'applied' }), { params: Promise.resolve({ id: TEST_APP_ID }) })
    // same status → no timeline write
    expect(timelineInsert).not.toHaveBeenCalled()
  })

  it('returns 401 for unauthenticated request', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await applicationPATCH(makeIdRequest('PATCH', { status: 'applied' }), { params: Promise.resolve({ id: TEST_APP_ID }) })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/applications/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReset()
    mockGetUser.mockReset()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('removes row and returns 204', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    })
    const res = await applicationDELETE(makeIdRequest('DELETE'), { params: Promise.resolve({ id: TEST_APP_ID }) })
    expect(res.status).toBe(204)
  })
})
