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

import { createClient } from '@/lib/supabase/server'
import { PUT } from '@/app/api/user/source-preferences/route'

const TEST_USER = { id: 'user-1' }

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/user/source-preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockFetchAndUpdate(currentPrefs: Record<string, unknown> | null = {}) {
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })
  mockFrom
    .mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { source_preferences: currentPrefs }, error: null }),
        }),
      }),
    })
    .mockReturnValueOnce({ update: updateMock })
  return updateMock
}

describe('PUT /api/user/source-preferences', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await PUT(makeRequest({ source: 'github', action: 'pin' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for empty source', async () => {
    const res = await PUT(makeRequest({ source: '', action: 'pin' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid action', async () => {
    const res = await PUT(makeRequest({ source: 'github', action: 'explode' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing source', async () => {
    const res = await PUT(makeRequest({ action: 'pin' }))
    expect(res.status).toBe(400)
  })

  it.each(['pin', 'hide', 'reset'] as const)('accepts valid action "%s"', async (action) => {
    const updateMock = mockFetchAndUpdate()
    const res = await PUT(makeRequest({ source: 'github', action }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.source_preferences).toBeDefined()
    expect(updateMock).toHaveBeenCalled()
  })

  it('merges new preference with existing preferences', async () => {
    const existing = { github: 'pinned' }
    const updateMock = mockFetchAndUpdate(existing)

    const res = await PUT(makeRequest({ source: 'manual', action: 'hide' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ source_preferences: expect.objectContaining({ github: 'pinned' }) })
    )
    expect(json.source_preferences).toMatchObject({ github: 'pinned' })
  })
})
