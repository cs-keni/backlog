import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parsePostedDate } from '../src/llm/normalizer'

describe('parsePostedDate', () => {
  // Pin "today" to 2026-03-20 for deterministic year inference
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns null for empty string', () => {
    expect(parsePostedDate('')).toBeNull()
  })

  it('returns null for unparseable string', () => {
    expect(parsePostedDate('TBD')).toBeNull()
  })

  it('assigns current year for a month <= current month', () => {
    // Jan (0) <= Mar (2) → 2026
    const result = parsePostedDate('Jan 15')
    expect(result).toContain('2026')
    expect(result).toContain('01-15') // ISO date fragment
  })

  it('assigns current year for the current month', () => {
    // Mar (2) == Mar (2) → 2026
    const result = parsePostedDate('Mar 5')
    expect(result).toContain('2026')
  })

  it('assigns previous year for a month > current month', () => {
    // Sep (8) > Mar (2) → 2025
    const result = parsePostedDate('Sep 5')
    expect(result).toContain('2025')
  })

  it('assigns previous year for December', () => {
    // Dec (11) > Mar (2) → 2025
    const result = parsePostedDate('Dec 20')
    expect(result).toContain('2025')
  })

  it('returns a valid ISO 8601 string', () => {
    const result = parsePostedDate('Feb 14')
    expect(result).not.toBeNull()
    expect(() => new Date(result!).toISOString()).not.toThrow()
  })

  it('handles case-insensitive month names', () => {
    const upper = parsePostedDate('JAN 1')
    const lower = parsePostedDate('jan 1')
    expect(upper).toBe(lower)
  })
})
