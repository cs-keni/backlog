import { afterEach, describe, expect, it, vi } from 'vitest'
import { freshnessColor, freshnessLabel } from '@/lib/tracker/freshness'

describe('job freshness', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('labels recent postings as today and green', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'))

    expect(freshnessLabel('2026-05-20T13:00:00.000Z')).toBe('Posted today')
    expect(freshnessColor('2026-05-20T13:00:00.000Z')).toBe('green')
  })

  it('labels week-old and month-old postings with appropriate colors', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'))

    expect(freshnessLabel('2026-05-15T12:00:00.000Z')).toBe('Posted 6d ago')
    expect(freshnessColor('2026-05-15T12:00:00.000Z')).toBe('green')
    expect(freshnessLabel('2026-05-05T12:00:00.000Z')).toBe('Posted 2w ago')
    expect(freshnessColor('2026-05-05T12:00:00.000Z')).toBe('yellow')
    expect(freshnessLabel('2026-04-01T12:00:00.000Z')).toBe('Posted 1mo ago')
    expect(freshnessColor('2026-04-01T12:00:00.000Z')).toBe('red')
  })

  it('returns null for missing or invalid dates', () => {
    expect(freshnessLabel(null)).toBeNull()
    expect(freshnessColor('not-a-date')).toBeNull()
  })
})
