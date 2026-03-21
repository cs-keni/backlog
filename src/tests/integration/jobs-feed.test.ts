import { describe, it, expect, beforeEach } from 'vitest'
import { detectAts, extractGreenhouseIds, extractLeverIds } from '../helpers/url-extractor-test-helpers'

// ─── URL extractor unit tests ─────────────────────────────────────────────────
// These test the URL detection/parsing logic without making real network calls.

describe('URL pattern detection', () => {
  it('identifies Greenhouse URLs', () => {
    expect(detectAts('https://boards.greenhouse.io/stripe/jobs/123456')).toBe('greenhouse')
    expect(detectAts('https://boards.greenhouse.io/acme-corp/jobs/789')).toBe('greenhouse')
  })

  it('identifies Lever URLs', () => {
    expect(detectAts('https://jobs.lever.co/stripe/abc-def-123')).toBe('lever')
    expect(detectAts('https://jobs.lever.co/openai/some-role-id')).toBe('lever')
  })

  it('returns other for unknown ATS URLs', () => {
    expect(detectAts('https://www.linkedin.com/jobs/view/123')).toBe('other')
    expect(detectAts('https://careers.google.com/jobs/results/123')).toBe('other')
    expect(detectAts('https://example.com/careers')).toBe('other')
  })

  it('extracts Greenhouse company and job ID', () => {
    const result = extractGreenhouseIds('https://boards.greenhouse.io/stripe/jobs/123456')
    expect(result).toEqual({ company: 'stripe', jobId: '123456' })
  })

  it('extracts Lever company and job ID', () => {
    const result = extractLeverIds('https://jobs.lever.co/openai/abc-def-1234')
    expect(result).toEqual({ company: 'openai', jobId: 'abc-def-1234' })
  })

  it('returns null for malformed Greenhouse URLs', () => {
    expect(extractGreenhouseIds('https://boards.greenhouse.io/stripe')).toBeNull()
    expect(extractGreenhouseIds('https://example.com')).toBeNull()
  })

  it('returns null for malformed Lever URLs', () => {
    expect(extractLeverIds('https://jobs.lever.co')).toBeNull()
    expect(extractLeverIds('https://example.com')).toBeNull()
  })
})

// ─── Feed API query param tests ───────────────────────────────────────────────

describe('Feed query param builder', () => {
  it('builds params for newest sort with no filters', () => {
    const params = buildFeedParams({ sort: 'newest' })
    expect(params.get('sort')).toBe('newest')
    expect(params.get('is_remote')).toBeNull()
    expect(params.get('location')).toBeNull()
  })

  it('builds params for remote filter', () => {
    const params = buildFeedParams({ isRemote: 'remote' })
    expect(params.get('is_remote')).toBe('true')
  })

  it('builds params for onsite filter', () => {
    const params = buildFeedParams({ isRemote: 'onsite' })
    expect(params.get('is_remote')).toBe('false')
  })

  it('includes cursor params when provided', () => {
    const params = buildFeedParams({}, { cursor: '2024-01-01T00:00:00Z', cursorId: 'abc-123' })
    expect(params.get('cursor')).toBe('2024-01-01T00:00:00Z')
    expect(params.get('cursorId')).toBe('abc-123')
  })

  it('does not include empty filter params', () => {
    const params = buildFeedParams({ location: '', experienceLevel: '' })
    expect(params.get('location')).toBeNull()
    expect(params.get('experience_level')).toBeNull()
  })
})

// ─── Helpers (mirrors logic from components, tests it in isolation) ───────────

type FeedOptions = {
  sort?: string
  isRemote?: 'all' | 'remote' | 'onsite'
  location?: string
  salaryMin?: string
  experienceLevel?: string
  roleType?: string
}

function buildFeedParams(
  opts: FeedOptions = {},
  cursor?: { cursor: string; cursorId: string }
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('sort', opts.sort ?? 'newest')
  if (opts.isRemote === 'remote') params.set('is_remote', 'true')
  if (opts.isRemote === 'onsite') params.set('is_remote', 'false')
  if (opts.location) params.set('location', opts.location)
  if (opts.salaryMin) params.set('salary_min', opts.salaryMin)
  if (opts.experienceLevel) params.set('experience_level', opts.experienceLevel)
  if (opts.roleType) params.set('role_type', opts.roleType)
  if (cursor) {
    params.set('cursor', cursor.cursor)
    params.set('cursorId', cursor.cursorId)
  }
  return params
}
