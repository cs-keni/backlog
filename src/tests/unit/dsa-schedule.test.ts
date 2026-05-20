import { describe, it, expect } from 'vitest'
import { computeReviewDates, SR_INTERVALS_DAYS, computeNextInterval, LEITNER_INTERVALS } from '@/lib/dsa/schedule'

describe('computeReviewDates', () => {
  it('returns 5 dates at the correct intervals', () => {
    const dates = computeReviewDates('2026-01-10')
    expect(dates).toHaveLength(5)
    expect(dates[0]).toBe('2026-01-10') // day 0 — same day
    expect(dates[1]).toBe('2026-01-11') // +1
    expect(dates[2]).toBe('2026-01-13') // +3
    expect(dates[3]).toBe('2026-01-17') // +7
    expect(dates[4]).toBe('2026-01-24') // +14
  })

  it('matches SR_INTERVALS_DAYS length', () => {
    const dates = computeReviewDates('2026-06-01')
    expect(dates).toHaveLength(SR_INTERVALS_DAYS.length)
  })

  it('handles month boundary correctly (Jan 30)', () => {
    const dates = computeReviewDates('2026-01-30')
    expect(dates[0]).toBe('2026-01-30')
    expect(dates[1]).toBe('2026-01-31') // +1
    expect(dates[2]).toBe('2026-02-02') // +3 crosses into Feb
    expect(dates[3]).toBe('2026-02-06') // +7
    expect(dates[4]).toBe('2026-02-13') // +14
  })

  it('handles leap year Feb 28 boundary', () => {
    const dates = computeReviewDates('2028-02-27') // 2028 is a leap year
    expect(dates[2]).toBe('2028-03-01') // Feb 27 + 3 = Mar 1
  })

  it('handles year boundary (Dec 30)', () => {
    const dates = computeReviewDates('2025-12-30')
    expect(dates[2]).toBe('2026-01-02') // +3 crosses into new year
    expect(dates[3]).toBe('2026-01-06') // +7
    expect(dates[4]).toBe('2026-01-13') // +14
  })
})

describe('computeNextInterval', () => {
  it('easy 1 → 3', () => expect(computeNextInterval(1, 'easy')).toBe(3))
  it('easy 3 → 7', () => expect(computeNextInterval(3, 'easy')).toBe(7))
  it('easy 7 → 14', () => expect(computeNextInterval(7, 'easy')).toBe(14))
  it('easy 14 → 30', () => expect(computeNextInterval(14, 'easy')).toBe(30))
  it('easy caps at 30', () => expect(computeNextInterval(30, 'easy')).toBe(30))
  it('easy beyond-ladder still returns 30', () => expect(computeNextInterval(45, 'easy')).toBe(30))
  it('easy 0-day interval starts at 3', () => expect(computeNextInterval(0, 'easy')).toBe(3))
  it('hard always resets to 1 regardless of current', () => {
    for (const n of LEITNER_INTERVALS) {
      expect(computeNextInterval(n, 'hard')).toBe(1)
    }
  })
})
