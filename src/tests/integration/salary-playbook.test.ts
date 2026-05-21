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
  const scriptsJson = JSON.stringify({
    recruiter_call: 'Hello, I wanted to discuss the offer.',
    email_counter: 'Thank you for the offer. I would like to propose a higher base.',
    deadline_extension: 'I appreciate the offer and need a few more days to decide.',
  })
  // Use plain function (not vi.fn) so vi.resetAllMocks() doesn't wipe it.
  function MockAnthropic() {
    return {
      messages: {
        create: () => Promise.resolve({ content: [{ type: 'text', text: scriptsJson }] }),
      },
    }
  }
  return { default: MockAnthropic }
})

import { createClient } from '@/lib/supabase/server'
import { GET, POST } from '@/app/api/prep/salary-playbook/route'

const TEST_USER = { id: 'user-1' }

function makeGetRequest(applicationId = 'app-1') {
  return new Request(`http://localhost/api/prep/salary-playbook?application_id=${applicationId}`)
}

function makePostRequest(body: unknown) {
  return new Request('http://localhost/api/prep/salary-playbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function offerApp(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'app-1',
      status: 'offer',
      jobs: { title: 'Software Engineer', company: 'Acme' },
      ...overrides,
    },
    error: null,
  }
}

function userProfile(overrides: Record<string, unknown> = {}) {
  return {
    data: { comp_target: 150000, comp_location_tier: 'tier1', ...overrides },
    error: null,
  }
}

function mockAppAndProfile(appData = offerApp(), profileData = userProfile()) {
  mockFrom
    .mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(appData),
          }),
        }),
      }),
    })
    .mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(profileData),
        }),
      }),
    })
}

describe('GET /api/prep/salary-playbook', () => {
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
    const res = await GET(new Request('http://localhost/api/prep/salary-playbook'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when application not found', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(userProfile()),
          }),
        }),
      })
    const res = await GET(makeGetRequest('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('returns 422 when application is not at offer stage', async () => {
    mockAppAndProfile(offerApp({ status: 'technical' }))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(422)
  })

  it('returns band and comp_target for an offer-stage application', async () => {
    mockAppAndProfile()
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({
      job: { title: 'Software Engineer', company: 'Acme' },
      comp_target: 150000,
      comp_location_tier: 'tier1',
    })
    expect(json.band).toMatchObject({ p25: expect.any(Number), p50: expect.any(Number), p75: expect.any(Number) })
  })
})

describe('POST /api/prep/salary-playbook', () => {
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

  it('returns structured scripts for an offer-stage application', async () => {
    mockAppAndProfile()
    const res = await POST(makePostRequest({ application_id: 'app-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.scripts).toMatchObject({
      recruiter_call: expect.any(String),
      email_counter: expect.any(String),
      deadline_extension: expect.any(String),
    })
    expect(json.band).toMatchObject({ p25: expect.any(Number) })
  })

  it('propagates 422 when application is not at offer stage', async () => {
    mockAppAndProfile(offerApp({ status: 'technical' }))
    const res = await POST(makePostRequest({ application_id: 'app-1' }))
    expect(res.status).toBe(422)
  })
})
