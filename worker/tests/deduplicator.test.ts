import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client before importing the deduplicator
vi.mock('../src/db/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { filterNewEntries, filterNewJobs } from '../src/jobs/deduplicator'
import { supabase } from '../src/db/client'
import type { RawJobEntry } from '../src/github/parser'
import type { NormalizedJob } from '../src/llm/normalizer'

const makeEntry = (url: string, title = 'SWE', company = 'Acme'): RawJobEntry => ({
  url,
  title,
  company,
  location: 'Remote',
  rawDate: 'Sep 5',
})

const makeJob = (url: string, title = 'Software Engineer', company = 'Acme'): NormalizedJob => ({
  url,
  title,
  company,
  location: 'Remote',
  country: 'United States',
  is_remote: true,
  salary_min: null,
  salary_max: null,
  experience_level: 'entry',
  tags: [],
  posted_at: null,
  description: null,
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

describe('filterNewJobs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all jobs when none exist in DB', async () => {
    const mockFrom = vi.mocked(supabase.from)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as never)

    const jobs = [makeJob('https://example.com/1'), makeJob('https://example.com/2')]
    const result = await filterNewJobs(jobs)
    expect(result).toHaveLength(2)
  })

  it('filters out jobs whose URLs already exist in DB', async () => {
    const mockFrom = vi.mocked(supabase.from)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [{ url: 'https://example.com/1' }],
          error: null,
        }),
      }),
    } as never)

    const jobs = [makeJob('https://example.com/1'), makeJob('https://example.com/2')]
    const result = await filterNewJobs(jobs)
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://example.com/2')
  })

  it('queries URLs in chunks to avoid PostgREST URL length limits', async () => {
    const mockFrom = vi.mocked(supabase.from)
    const inMock = vi.fn().mockResolvedValue({ data: [], error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ in: inMock }),
    } as never)

    const jobs = Array.from({ length: 51 }, (_, i) => makeJob(`https://example.com/${i}`))
    const result = await filterNewJobs(jobs)

    expect(result).toHaveLength(51)
    expect(inMock).toHaveBeenCalledTimes(2)
    expect(inMock.mock.calls[0][1]).toHaveLength(50)
    expect(inMock.mock.calls[1][1]).toHaveLength(1)
  })

  it('returns all jobs when DB query fails (fail-open)', async () => {
    const mockFrom = vi.mocked(supabase.from)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'connection refused' },
        }),
      }),
    } as never)

    const jobs = [makeJob('https://example.com/1')]
    const result = await filterNewJobs(jobs)
    expect(result).toHaveLength(1)
  })

  it('returns empty array for empty input without hitting DB', async () => {
    const mockFrom = vi.mocked(supabase.from)
    const result = await filterNewJobs([])
    expect(result).toHaveLength(0)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
