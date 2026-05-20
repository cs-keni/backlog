import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSupabase, mockGetUser, mockFrom, mockAdminStorageFrom, mockAdminFrom, mockExtractTextFromPdf, mockAnalyzeResume } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockAdminStorageFrom = vi.fn()
  const mockAdminFrom = vi.fn()
  const mockExtractTextFromPdf = vi.fn()
  const mockAnalyzeResume = vi.fn()
  return {
    mockSupabase: { auth: { getUser: mockGetUser }, from: mockFrom },
    mockGetUser,
    mockFrom,
    mockAdminStorageFrom,
    mockAdminFrom,
    mockExtractTextFromPdf,
    mockAnalyzeResume,
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: { from: mockAdminStorageFrom },
    from: mockAdminFrom,
  })),
}))
vi.mock('@/lib/pdf/parser', () => ({ extractTextFromPdf: mockExtractTextFromPdf }))
vi.mock('@/lib/llm/resume-analyzer', () => ({ analyzeResume: mockAnalyzeResume }))

import { createClient } from '@/lib/supabase/server'
import { POST as postWorkHistory } from '@/app/api/profile/work-history/route'
import { PATCH as patchWorkHistory, DELETE as deleteWorkHistory } from '@/app/api/profile/work-history/[id]/route'
import { PATCH as patchEducation } from '@/app/api/profile/education/[id]/route'
import { PATCH as patchProject } from '@/app/api/profile/projects/[id]/route'
import { PATCH as patchSavedAnswer } from '@/app/api/profile/saved-answers/[id]/route'
import { POST as postResume } from '@/app/api/profile/resume/route'

const TEST_USER = { id: 'user-1', email: 'test@example.com' }
const OTHER_USER = { id: 'user-2', email: 'other@example.com' }

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function idParams(id = 'row-1') {
  return { params: Promise.resolve({ id }) }
}

function ownerSelect(ownerId: string | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(ownerId ? { data: { user_id: ownerId }, error: null } : { data: null, error: { message: 'not found' } }),
      }),
    }),
  }
}

function updateSingle(row: Record<string, unknown>) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: row, error: null }),
        }),
      }),
    }),
  }
}

describe('profile mutation routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReset()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('POST /api/profile/work-history creates a row and returns id', async () => {
    const inserted = { id: 'work-1', user_id: TEST_USER.id, company: 'Acme', title: 'Engineer' }
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
      }),
    })
    const staleUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockFrom
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({ update: staleUpdate })

    const res = await postWorkHistory(jsonRequest('http://localhost/api/profile/work-history', {
      company: 'Acme',
      title: 'Engineer',
    }))

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual(inserted)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: TEST_USER.id,
      company: 'Acme',
      title: 'Engineer',
    }))
  })

  it('PATCH /api/profile/work-history/:id updates owner rows', async () => {
    mockFrom
      .mockReturnValueOnce(ownerSelect(TEST_USER.id))
      .mockReturnValueOnce(updateSingle({ id: 'work-1', title: 'Senior Engineer' }))

    const res = await patchWorkHistory(
      jsonRequest('http://localhost/api/profile/work-history/work-1', { title: 'Senior Engineer' }),
      idParams('work-1')
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ title: 'Senior Engineer' })
  })

  it('PATCH /api/profile/work-history/:id returns 403 for non-owner rows', async () => {
    const update = vi.fn()
    mockFrom
      .mockReturnValueOnce(ownerSelect(OTHER_USER.id))
      .mockReturnValueOnce({ update })

    const res = await patchWorkHistory(
      jsonRequest('http://localhost/api/profile/work-history/work-1', { title: 'Senior Engineer' }),
      idParams('work-1')
    )

    expect(res.status).toBe(403)
    expect(update).not.toHaveBeenCalled()
  })

  it('DELETE /api/profile/work-history/:id removes owner rows', async () => {
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const staleUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockFrom
      .mockReturnValueOnce(ownerSelect(TEST_USER.id))
      .mockReturnValueOnce({ delete: deleteMock })
      .mockReturnValueOnce({ update: staleUpdate })

    const res = await deleteWorkHistory(new Request('http://localhost/api/profile/work-history/work-1'), idParams('work-1'))

    expect(res.status).toBe(204)
    expect(deleteMock).toHaveBeenCalled()
  })

  it.each([
    ['education', patchEducation],
    ['projects', patchProject],
    ['saved_answers', patchSavedAnswer],
  ])('PATCH /api/profile/%s/:id returns 403 for non-owner rows', async (_table, route) => {
    const update = vi.fn()
    mockFrom
      .mockReturnValueOnce(ownerSelect(OTHER_USER.id))
      .mockReturnValueOnce({ update })

    const res = await route(
      jsonRequest('http://localhost/api/profile/resource/row-1', { title: 'ignored', school: 'ignored', question: 'ignored' }),
      idParams('row-1')
    )

    expect(res.status).toBe(403)
    expect(update).not.toHaveBeenCalled()
  })

  it('POST /api/profile/resume updates resume_text and invalidates match scores', async () => {
    mockAdminStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/resume.pdf' } }),
    })
    mockExtractTextFromPdf.mockResolvedValue('This is a parsed software engineering resume with enough text to pass extraction.')
    mockAnalyzeResume.mockResolvedValue(null)

    const updateUsers = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const updateScores = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockFrom
      .mockReturnValueOnce({ update: updateUsers })
      .mockReturnValueOnce({ update: updateScores })

    const formData = new FormData()
    formData.set('resume', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }))

    const res = await postResume({
      url: 'http://localhost/api/profile/resume?dry_run=true',
      formData: async () => formData,
    } as unknown as Request)

    expect(res.status).toBe(200)
    expect(updateUsers).toHaveBeenCalledWith({
      resume_url: 'https://cdn.example/resume.pdf',
      resume_text: 'This is a parsed software engineering resume with enough text to pass extraction.',
    })
    expect(updateScores).toHaveBeenCalledWith({ is_stale: true })
  })
})
