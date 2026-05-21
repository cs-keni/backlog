import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabase, mockGetUser, mockFrom, mockServiceFrom } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockServiceFrom = vi.fn()
  return {
    mockSupabase: { auth: { getUser: mockGetUser }, from: mockFrom },
    mockGetUser,
    mockFrom,
    mockServiceFrom,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

import { createClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/jobs/manual/route'

const TEST_USER = { id: 'user-1', email: 'test@example.com' }

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/jobs/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function companyUpsert(data: { id: string } | null, error: unknown = null) {
  return {
    upsert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  }
}

function jobInsert(data: unknown, error: unknown = null) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  }
}

function jobSelect(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  }
}

function existingApplication(data: unknown) {
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

function applicationUpsert(data: unknown, error: unknown = null) {
  return {
    upsert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  }
}

describe('POST /api/jobs/manual', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('creates a manual application without a job URL', async () => {
    const job = {
      id: 'job-1',
      title: 'Software Engineer',
      company: 'Example Co',
      location: null,
      salary_min: null,
      salary_max: null,
      url: null,
      is_remote: false,
      tags: null,
    }
    const application = {
      id: 'app-1',
      user_id: TEST_USER.id,
      job_id: job.id,
      status: 'applied',
      is_archived: false,
      applied_at: '2026-05-21T12:00:00.000Z',
      last_updated: '2026-05-21T12:00:00.000Z',
      notes: null,
      recruiter_name: null,
      recruiter_email: null,
    }
    const timelineInsert = vi.fn().mockResolvedValue({ error: null })

    const insertBuilder = jobInsert(job)
    mockServiceFrom
      .mockReturnValueOnce(companyUpsert({ id: 'company-1' }))
      .mockReturnValueOnce(insertBuilder)

    mockFrom
      .mockReturnValueOnce(existingApplication(null))
      .mockReturnValueOnce(applicationUpsert(application))
      .mockReturnValueOnce({ insert: timelineInsert })

    const res = await POST(makeRequest({ company: 'Example Co', title: 'Software Engineer' }))

    expect(res.status).toBe(201)
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      company_id: 'company-1',
      url: null,
      source: 'manual',
    }))
    expect(timelineInsert).toHaveBeenCalledWith(expect.objectContaining({
      application_id: application.id,
      from_status: null,
      to_status: 'applied',
    }))
  })

  it('reuses an existing job when the URL unique constraint is hit', async () => {
    const duplicateError = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const job = {
      id: 'job-existing',
      title: 'Software Engineer',
      company: 'Example Co',
      location: null,
      salary_min: null,
      salary_max: null,
      url: 'https://example.com/job',
      is_remote: false,
      tags: null,
    }
    const application = {
      id: 'app-1',
      user_id: TEST_USER.id,
      job_id: job.id,
      status: 'applied',
      is_archived: false,
      applied_at: '2026-05-21T12:00:00.000Z',
      last_updated: '2026-05-21T12:00:00.000Z',
      notes: null,
      recruiter_name: null,
      recruiter_email: null,
    }

    const fallbackSelect = jobSelect(job)
    const timelineInsert = vi.fn().mockResolvedValue({ error: null })
    mockServiceFrom
      .mockReturnValueOnce(companyUpsert({ id: 'company-1' }))
      .mockReturnValueOnce(jobInsert(null, duplicateError))
      .mockReturnValueOnce(fallbackSelect)

    mockFrom
      .mockReturnValueOnce(existingApplication(null))
      .mockReturnValueOnce(applicationUpsert(application))
      .mockReturnValueOnce({ insert: timelineInsert })

    const res = await POST(makeRequest({
      company: 'Example Co',
      title: 'Software Engineer',
      url: 'https://example.com/job',
    }))

    expect(res.status).toBe(201)
    expect(fallbackSelect.select().eq).toHaveBeenCalledWith('url', 'https://example.com/job')
    await expect(res.json()).resolves.toMatchObject({
      job_id: 'job-existing',
      application_id: 'app-1',
    })
  })
})
