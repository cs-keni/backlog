import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabase, mockGetUser, mockFrom, mockAdminStorageFrom, mockTailorResume, mockGenerateResumePDF } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockAdminStorageFrom = vi.fn()
  const mockTailorResume = vi.fn()
  const mockGenerateResumePDF = vi.fn()
  return {
    mockSupabase: { auth: { getUser: mockGetUser }, from: mockFrom },
    mockGetUser,
    mockFrom,
    mockAdminStorageFrom,
    mockTailorResume,
    mockGenerateResumePDF,
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: { from: mockAdminStorageFrom },
  })),
}))
vi.mock('@/lib/llm/resume-tailor', () => ({
  tailorResume: mockTailorResume,
}))
vi.mock('@/lib/pdf/resume-generator', () => ({
  generateResumePDF: mockGenerateResumePDF,
}))

import { createClient } from '@/lib/supabase/server'
import { GET, POST } from '@/app/api/resume/tailor/route'

const TEST_USER = { id: 'user-1', email: 'test@example.com' }

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/resume/tailor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
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

function versionLookup(data: unknown) {
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

describe('resume tailor routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
    mockTailorResume.mockResolvedValue({ summary: 'Tailored summary', work: [] })
    mockGenerateResumePDF.mockResolvedValue(Buffer.from('fake-pdf'))
    mockAdminStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/resume.pdf' } }),
    })
  })

  it('GET returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await GET(new Request('http://localhost/api/resume/tailor?job_id=job-1'))

    expect(res.status).toBe(401)
  })

  it('GET returns 400 when job_id is missing', async () => {
    const res = await GET(new Request('http://localhost/api/resume/tailor'))

    expect(res.status).toBe(400)
  })

  it('GET returns null when no version exists', async () => {
    mockFrom.mockReturnValueOnce(versionLookup(null))

    const res = await GET(new Request('http://localhost/api/resume/tailor?job_id=job-1'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toBeNull()
  })

  it('GET returns an existing version', async () => {
    const version = { id: 'version-1', pdf_url: 'https://cdn.example/resume.pdf', created_at: '2026-05-21T00:00:00Z' }
    mockFrom.mockReturnValueOnce(versionLookup(version))

    const res = await GET(new Request('http://localhost/api/resume/tailor?job_id=job-1'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(version)
  })

  it('POST returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await POST(jsonRequest({ job_id: 'job-1' }))

    expect(res.status).toBe(401)
  })

  it('POST returns 400 when job_id is missing', async () => {
    const res = await POST(jsonRequest({}))

    expect(res.status).toBe(400)
  })

  it('POST returns 400 when resume text is missing or too short', async () => {
    mockFrom
      .mockReturnValueOnce(selectEqSingle({ resume_text: 'short' }))
      .mockReturnValueOnce(selectEqOrder([]))
      .mockReturnValueOnce(selectEqOrder([]))
      .mockReturnValueOnce(selectEqSingle({ id: 'job-1', title: 'Engineer', company: 'Acme', description: null, tags: [] }))
      .mockReturnValueOnce(selectEqOrder([]))

    const res = await POST(jsonRequest({ job_id: 'job-1' }))

    expect(res.status).toBe(400)
  })

  it('POST generates a PDF, uploads it, and returns a pdf_url', async () => {
    mockFrom
      .mockReturnValueOnce(selectEqSingle({
        full_name: 'Kenny',
        email: 'test@example.com',
        phone: null,
        address: null,
        linkedin_url: null,
        github_url: null,
        skills: ['React'],
        resume_text: 'A'.repeat(120),
      }))
      .mockReturnValueOnce(selectEqOrder([]))
      .mockReturnValueOnce(selectEqOrder([]))
      .mockReturnValueOnce(selectEqSingle({ id: 'job-1', title: 'Engineer', company: 'Acme', description: 'Build UI', tags: [] }))
      .mockReturnValueOnce(selectEqOrder([]))
      .mockReturnValueOnce(versionLookup(null))
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'version-1' }, error: null }),
          }),
        }),
      })

    const res = await POST(jsonRequest({ job_id: 'job-1' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      id: 'version-1',
      pdf_url: 'https://cdn.example/resume.pdf',
    })
  })
})
