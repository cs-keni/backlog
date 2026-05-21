import { describe, expect, it } from 'vitest'
import { isLocationTier, lookupCompBand } from '@/lib/salary/comp-bands'

describe('comp bands', () => {
  it('maps major title buckets', () => {
    expect(lookupCompBand('Senior Software Engineer', 'tier1').p50).toBe(360000)
    expect(lookupCompBand('Staff Product Manager', 'tier1').p50).toBe(400000)
    expect(lookupCompBand('Director of Engineering', 'tier1').p50).toBe(550000)
    expect(lookupCompBand('Data Scientist', 'tier1').p50).toBe(220000)
    expect(lookupCompBand('Product Designer', 'tier1').p50).toBe(210000)
  })

  it('scales non-tier1 bands and validates tiers', () => {
    expect(lookupCompBand('Software Engineer', 'tier2').p50).toBe(208000)
    expect(lookupCompBand('Software Engineer', 'tier3').p50).toBe(169000)
    expect(isLocationTier('remote')).toBe(true)
    expect(isLocationTier('mars')).toBe(false)
  })
})
