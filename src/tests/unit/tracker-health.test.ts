import { describe, expect, it } from 'vitest'
import { getCompanyTier } from '@/lib/tracker/company-tier'
import { getApplicationHealth } from '@/lib/tracker/health'

const NOW = new Date('2026-05-21T12:00:00.000Z').getTime()

function daysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString()
}

describe('application health', () => {
  it('classifies company tiers', () => {
    expect(getCompanyTier('Google')).toBe('faang')
    expect(getCompanyTier('Salesforce')).toBe('large')
    expect(getCompanyTier('Rippling')).toBe('mid')
    expect(getCompanyTier('Tiny Startup')).toBe('startup')
  })

  it('marks FAANG applications near the response window as yellow', () => {
    expect(getApplicationHealth(daysAgo(12), 'faang', NOW)).toBe('yellow')
  })

  it('marks stale startup applications as red', () => {
    expect(getApplicationHealth(daysAgo(30), 'startup', NOW)).toBe('red')
  })

  it('marks fresh mid-market applications as green', () => {
    expect(getApplicationHealth(daysAgo(3), 'mid', NOW)).toBe('green')
  })
})
