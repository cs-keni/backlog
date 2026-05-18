import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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
import { GET } from '@/app/api/analytics/route'

const TEST_USER = { id: 'user-1', email: 'test@example.com' }

function makeRequest(range = '30d'): NextRequest {
  return new NextRequest(`http://localhost/api/analytics?range=${range}`)
}

describe('GET /api/analytics', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReset()
    mockGetUser.mockReset()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated request', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('counts github, portal/search, and manual jobs separately', async () => {
    const now = new Date().toISOString()
    const applications = [
      {
        id: 'app-1',
        job_id: 'job-github',
        status: 'applied',
        is_archived: false,
        applied_at: now,
        last_updated: now,
      },
      {
        id: 'app-2',
        job_id: 'job-portal',
        status: 'technical',
        is_archived: false,
        applied_at: now,
        last_updated: now,
      },
      {
        id: 'app-3',
        job_id: 'job-manual',
        status: 'offer',
        is_archived: false,
        applied_at: now,
        last_updated: now,
      },
      {
        id: 'app-4',
        job_id: 'job-legacy',
        status: 'saved',
        is_archived: false,
        applied_at: null,
        last_updated: now,
      },
    ]
    const jobs = [
      { id: 'job-github', company: 'GitHub Co', source: 'github', fetched_at: now },
      { id: 'job-portal', company: 'Portal Co', source: 'portal', fetched_at: now },
      { id: 'job-manual', company: 'Manual Co', source: 'manual', fetched_at: now },
      { id: 'job-legacy', company: 'Legacy Co', source: 'legacy', fetched_at: now },
    ]
    let jobsCallCount = 0

    mockFrom.mockImplementation((table: string) => {
      if (table === 'applications') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: applications, error: null }),
          }),
        }
      }
      if (table === 'jobs') {
        jobsCallCount++
        if (jobsCallCount === 2) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: jobs.map(({ id, source }) => ({ id, source })), error: null }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: jobs, error: null }),
          }),
        }
      }
      if (table === 'application_timeline') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.sourceBreakdown).toEqual({ github: 2, portal: 1, manual: 1 })
    expect(json.stats.jobsInRange).toBe(4)
    expect(json.sourceYield).toEqual([
      {
        source: 'github',
        label: 'Aggregated feed',
        applications: 2,
        submitted: 1,
        responses: 0,
        interviews: 0,
        offers: 0,
        responseRate: 0,
        interviewRate: 0,
      },
      {
        source: 'portal',
        label: 'Company/search discovery',
        applications: 1,
        submitted: 1,
        responses: 1,
        interviews: 1,
        offers: 0,
        responseRate: 100,
        interviewRate: 100,
      },
      {
        source: 'manual',
        label: 'Manually added',
        applications: 1,
        submitted: 1,
        responses: 1,
        interviews: 1,
        offers: 1,
        responseRate: 100,
        interviewRate: 100,
      },
    ])
  })
})
