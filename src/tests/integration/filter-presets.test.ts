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

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/filter-presets/route'
import { DELETE } from '@/app/api/filter-presets/[id]/route'

const TEST_USER = { id: 'user-1', email: 'test@example.com' }
const TEST_PRESET_ID = 'preset-1'

const VALID_FILTERS = {
  version: 1,
  search: 'backend',
  location: 'New York',
  isRemote: 'remote',
  country: 'us',
  salaryMin: '100000',
  experienceLevel: 'mid',
  roleType: 'full_time',
  dateRange: '7d',
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/filter-presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockPresetCount(count: number) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ count, error: null }),
    }),
  })
}

describe('POST /api/filter-presets', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReset()
    mockGetUser.mockReset()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('creates preset', async () => {
    mockPresetCount(0)
    const inserted = {
      id: TEST_PRESET_ID,
      user_id: TEST_USER.id,
      name: 'Remote NYC',
      filters: VALID_FILTERS,
      created_at: '2026-05-20T00:00:00.000Z',
    }
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
      }),
    })
    mockFrom.mockReturnValueOnce({ insert })

    const res = await POST(makePostRequest({ name: 'Remote NYC', filters: VALID_FILTERS }))

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual(inserted)
    expect(insert).toHaveBeenCalledWith({
      user_id: TEST_USER.id,
      name: 'Remote NYC',
      filters: VALID_FILTERS,
    })
  })

  it('returns 422 at the 20 preset limit', async () => {
    mockPresetCount(20)

    const res = await POST(makePostRequest({ name: 'Too many', filters: VALID_FILTERS }))

    expect(res.status).toBe(422)
    await expect(res.json()).resolves.toEqual({ error: "You've reached the 20 preset limit" })
  })

  it('returns 422 when name exceeds 50 characters', async () => {
    const res = await POST(makePostRequest({ name: 'x'.repeat(51), filters: VALID_FILTERS }))

    expect(res.status).toBe(422)
    await expect(res.json()).resolves.toEqual({ error: 'Preset name must be 50 characters or fewer' })
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/filter-presets/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReset()
    mockGetUser.mockReset()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('removes preset', async () => {
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockFrom.mockReturnValueOnce({ delete: deleteMock })

    const res = await DELETE(
      new Request(`http://localhost/api/filter-presets/${TEST_PRESET_ID}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: TEST_PRESET_ID }) }
    )

    expect(res.status).toBe(204)
    expect(deleteMock).toHaveBeenCalled()
  })
})
