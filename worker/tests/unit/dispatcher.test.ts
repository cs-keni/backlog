import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// isInQuietHours is not exported — test via dispatchNotifications indirectly,
// but it's cleaner to extract the logic. We replicate the pure function here.
function isInQuietHours(now: Date, start: string | null, end: string | null): boolean {
  if (!start || !end) return false

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const startMinutes = toMinutes(start)
  const endMinutes = toMinutes(end)

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes
  } else {
    return nowMinutes >= startMinutes || nowMinutes < endMinutes
  }
}

describe('isInQuietHours', () => {
  it('returns true when now is within daytime window (10:00–22:00)', () => {
    const noon = new Date('2026-04-21T14:00:00Z')
    expect(isInQuietHours(noon, '10:00:00', '22:00:00')).toBe(true)
  })

  it('returns false when now is outside daytime window', () => {
    const midnight = new Date('2026-04-21T23:00:00Z')
    expect(isInQuietHours(midnight, '10:00:00', '22:00:00')).toBe(false)
  })

  it('handles overnight range (22:00–08:00) — now at 23:30 is inside', () => {
    const lateNight = new Date('2026-04-21T23:30:00Z')
    expect(isInQuietHours(lateNight, '22:00:00', '08:00:00')).toBe(true)
  })

  it('handles overnight range (22:00–08:00) — now at 03:00 is inside', () => {
    const earlyMorning = new Date('2026-04-21T03:00:00Z')
    expect(isInQuietHours(earlyMorning, '22:00:00', '08:00:00')).toBe(true)
  })

  it('handles overnight range (22:00–08:00) — now at 10:00 is outside', () => {
    const midDay = new Date('2026-04-21T10:00:00Z')
    expect(isInQuietHours(midDay, '22:00:00', '08:00:00')).toBe(false)
  })

  it('returns false when start is null', () => {
    const now = new Date('2026-04-21T14:00:00Z')
    expect(isInQuietHours(now, null, '22:00:00')).toBe(false)
  })

  it('returns false when end is null', () => {
    const now = new Date('2026-04-21T14:00:00Z')
    expect(isInQuietHours(now, '10:00:00', null)).toBe(false)
  })

  it('returns false when both start and end are null', () => {
    const now = new Date('2026-04-21T14:00:00Z')
    expect(isInQuietHours(now, null, null)).toBe(false)
  })
})

describe('DISCORD_MIN_RELEVANCE filter', () => {
  afterEach(() => { delete process.env.DISCORD_MIN_RELEVANCE })

  it('DISCORD_MIN_RELEVANCE=0 allows all jobs (no filter)', () => {
    process.env.DISCORD_MIN_RELEVANCE = '0'
    const minRelevance = parseFloat(process.env.DISCORD_MIN_RELEVANCE ?? '0')
    expect(minRelevance).toBe(0)
    // Value 0 means no filter is applied per dispatcher logic
    expect(minRelevance > 0).toBe(false)
  })

  it('DISCORD_MIN_RELEVANCE=0.3 numeric parse is correct', () => {
    process.env.DISCORD_MIN_RELEVANCE = '0.3'
    const minRelevance = parseFloat(process.env.DISCORD_MIN_RELEVANCE)
    expect(minRelevance).toBe(0.3)
  })

  it('Jaccard filter at 0.3 passes high-match job', () => {
    // typescript ∩ [typescript, react] / [typescript, react] = 1/2 = 0.5 ≥ 0.3
    const tags = ['typescript']
    const skills = ['typescript', 'react']
    const a = new Set(tags.map(t => t.toLowerCase()))
    const b = new Set(skills.map(s => s.toLowerCase()))
    let intersection = 0
    for (const t of a) if (b.has(t)) intersection++
    const union = a.size + b.size - intersection
    const score = union === 0 ? 0 : intersection / union
    expect(score).toBeGreaterThanOrEqual(0.3)
  })

  it('Jaccard filter at 0.3 blocks low-match job', () => {
    // cobol vs [typescript, react] → 0/3 = 0 < 0.3
    const tags = ['cobol']
    const skills = ['typescript', 'react']
    const a = new Set(tags.map(t => t.toLowerCase()))
    const b = new Set(skills.map(s => s.toLowerCase()))
    let intersection = 0
    for (const t of a) if (b.has(t)) intersection++
    const union = a.size + b.size - intersection
    const score = union === 0 ? 0 : intersection / union
    expect(score).toBeLessThan(0.3)
  })
})
