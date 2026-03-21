import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client before importing the deduplicator
vi.mock('../src/db/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { filterNewEntries } from '../src/jobs/deduplicator'
import { supabase } from '../src/db/client'
import type { RawJobEntry } from '../src/github/parser'

const makeEntry = (url: string, title = 'SWE', company = 'Acme'): RawJobEntry => ({
  url,
  title,
  company,
  location: 'Remote',
  rawDate: 'Sep 5',
})

describe('filterNewEntries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all entries when none exist in DB', async () => {
    const mockFrom = vi.mocked(supabase.from)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as never)

    const entries = [makeEntry('https://example.com/1'), makeEntry('https://example.com/2')]
    const result = await filterNewEntries(entries)
    expect(result).toHaveLength(2)
  })

  it('filters out entries whose URLs already exist in DB', async () => {
    const mockFrom = vi.mocked(supabase.from)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [{ url: 'https://example.com/1' }],
          error: null,
        }),
      }),
    } as never)

    const entries = [makeEntry('https://example.com/1'), makeEntry('https://example.com/2')]
    const result = await filterNewEntries(entries)
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://example.com/2')
  })

  it('returns all entries when DB query fails (fail-open)', async () => {
    const mockFrom = vi.mocked(supabase.from)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'connection refused' },
        }),
      }),
    } as never)

    const entries = [makeEntry('https://example.com/1')]
    const result = await filterNewEntries(entries)
    expect(result).toHaveLength(1)
  })

  it('returns empty array for empty input without hitting DB', async () => {
    const mockFrom = vi.mocked(supabase.from)
    const result = await filterNewEntries([])
    expect(result).toHaveLength(0)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
