import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────────────────────
// vi.mock is hoisted, so the factory cannot reference outer variables at definition
// time. We hoist the mock object with vi.hoisted() instead.

const { mockSupabase, mockGetUser, mockFrom, mockVerifyApiKeyFromRequest, mockServiceFrom } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockVerifyApiKeyFromRequest = vi.fn()
  const mockServiceFrom = vi.fn()
  return {
    mockSupabase: { auth: { getUser: mockGetUser }, from: mockFrom },
    mockGetUser,
    mockFrom,
    mockVerifyApiKeyFromRequest,
    mockServiceFrom,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-key', () => ({
  verifyApiKeyFromRequest: mockVerifyApiKeyFromRequest,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

import { createClient } from '@/lib/supabase/server'
import { POST as applicationsPOST } from '@/app/api/applications/route'
import { PATCH as applicationPATCH, DELETE as applicationDELETE } from '@/app/api/applications/[id]/route'
import { POST as extensionApplyPOST } from '@/app/api/extension/apply/route'
import { POST as batchPOST } from '@/app/api/applications/batch/route'

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

function makeExtensionApplyRequest(body: unknown): Request {
  return new Request('http://localhost/api/extension/apply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer blg_test',
    },
    body: JSON.stringify(body),
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
    // jobs URL lookup for ATS detection (only for new applications)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { url: 'https://boards.greenhouse.io/acme/jobs/123' } }),
        }),
      }),
    })
    // upsert → returns new app
    mockFrom.mockReturnValueOnce({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'saved', ats_platform: 'greenhouse' }, error: null }),
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
                single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'applied' }, error: null }),
              }),
            }),
          }),
        }
      }),
    })
    const timelineInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValueOnce({ insert: timelineInsert })

    await applicationPATCH(makeIdRequest('PATCH', { status: 'applied' }), { params: Promise.resolve({ id: TEST_APP_ID }) })

    expect(capturedUpdates).toMatchObject({ status: 'applied' })
    expect(capturedUpdates?.last_updated).toEqual(expect.any(String))
    expect(timelineInsert).toHaveBeenCalledWith({
      application_id: TEST_APP_ID,
      from_status: 'saved',
      to_status: 'applied',
      changed_at: expect.any(String),
    })
  })

  it('updates last_updated without writing timeline row when status is unchanged', async () => {
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
    const timelineInsert = vi.fn()
    mockFrom.mockReturnValueOnce({ insert: timelineInsert })

    await applicationPATCH(makeIdRequest('PATCH', { status: 'applied' }), { params: Promise.resolve({ id: TEST_APP_ID }) })

    expect(capturedUpdates).toMatchObject({ status: 'applied' })
    expect(capturedUpdates?.last_updated).toEqual(expect.any(String))
    expect(timelineInsert).not.toHaveBeenCalled()
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

describe('POST /api/applications/batch', () => {
  function makeBatchRequest(body: unknown): Request {
    return new Request('http://localhost/api/applications/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReset()
    mockGetUser.mockReset()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('archives 3 own applications and returns 200', async () => {
    const ids = ['app-1', 'app-2', 'app-3']
    // ownership check — all 3 owned
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: ids.map((id) => ({ id })), error: null }),
        }),
      }),
    })
    // batch update
    const batchUpdate = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockFrom.mockReturnValueOnce({ update: batchUpdate })

    const res = await batchPOST(makeBatchRequest({ ids, action: 'archive' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ updated: 3 })
    expect(batchUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_archived: true }))
  })

  it('returns 403 when any ID belongs to a different user', async () => {
    const ids = ['app-1', 'app-2', 'app-foreign']
    // ownership check — only 2 of 3 owned
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [{ id: 'app-1' }, { id: 'app-2' }], error: null }),
        }),
      }),
    })
    const batchUpdate = vi.fn()
    mockFrom.mockReturnValueOnce({ update: batchUpdate })

    const res = await batchPOST(makeBatchRequest({ ids, action: 'archive' }))
    expect(res.status).toBe(403)
    expect(batchUpdate).not.toHaveBeenCalled()
  })

  it('returns 422 for empty ids array', async () => {
    const res = await batchPOST(makeBatchRequest({ ids: [], action: 'archive' }))
    expect(res.status).toBe(422)
  })
})

describe('POST /api/extension/apply', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockServiceFrom.mockReset()
    mockVerifyApiKeyFromRequest.mockResolvedValue({ userId: TEST_USER.id, keyId: 'key-1' })
  })

  it('creates a hidden extension job, application, and initial timeline row for an untracked URL', async () => {
    const jobInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: TEST_JOB_ID }, error: null }),
      }),
    })
    const applicationInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID }, error: null }),
      }),
    })
    const timelineInsert = vi.fn().mockResolvedValue({ error: null })

    mockServiceFrom
      // Existing job lookup by URL
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      })
      // Hidden job stub insert
      .mockReturnValueOnce({ insert: jobInsert })
      // Existing application lookup
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      })
      // New application insert
      .mockReturnValueOnce({ insert: applicationInsert })
      // Initial timeline row
      .mockReturnValueOnce({ insert: timelineInsert })

    const res = await extensionApplyPOST(makeExtensionApplyRequest({
      jobUrl: 'https://example.com/jobs/123',
      jobTitle: 'Software Engineer',
      company: 'Example Co',
    }))

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ applicationId: TEST_APP_ID, created: true })
    expect(jobInsert).toHaveBeenCalledWith({
      url: 'https://example.com/jobs/123',
      title: 'Software Engineer',
      company: 'Example Co',
      source: 'manual',
      hide_from_feed: true,
      posted_at: expect.any(String),
      fetched_at: expect.any(String),
    })
    expect(applicationInsert).toHaveBeenCalledWith({
      user_id: TEST_USER.id,
      job_id: TEST_JOB_ID,
      status: 'applied',
      applied_at: expect.any(String),
      last_updated: expect.any(String),
    })
    expect(timelineInsert).toHaveBeenCalledWith({
      application_id: TEST_APP_ID,
      from_status: null,
      to_status: 'applied',
      note: 'Applied via Backlog extension',
    })
  })

  it('updates a saved Backlog-initiated application and writes one applied timeline row', async () => {
    const applicationUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const timelineInsert = vi.fn().mockResolvedValue({ error: null })

    mockServiceFrom
      // Existing application lookup by explicit applicationId
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: TEST_APP_ID, status: 'saved' } }),
            }),
          }),
        }),
      })
      // Status update to applied
      .mockReturnValueOnce({ update: applicationUpdate })
      // Timeline row
      .mockReturnValueOnce({ insert: timelineInsert })

    const res = await extensionApplyPOST(makeExtensionApplyRequest({
      jobUrl: 'https://example.com/jobs/123',
      applicationId: TEST_APP_ID,
    }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ applicationId: TEST_APP_ID, created: false })
    expect(applicationUpdate).toHaveBeenCalledWith({
      status: 'applied',
      applied_at: expect.any(String),
      last_updated: expect.any(String),
    })
    expect(timelineInsert).toHaveBeenCalledWith({
      application_id: TEST_APP_ID,
      from_status: 'saved',
      to_status: 'applied',
      note: 'Applied via Backlog extension',
    })
  })

  it('returns 401 when extension API-key auth fails', async () => {
    mockVerifyApiKeyFromRequest.mockResolvedValueOnce(null)

    const res = await extensionApplyPOST(makeExtensionApplyRequest({
      jobUrl: 'https://example.com/jobs/123',
    }))

    expect(res.status).toBe(401)
    expect(mockServiceFrom).not.toHaveBeenCalled()
  })
})
