import { describe, expect, it } from 'vitest'
import { COMPANY_PATTERNS, getCompanyPatterns } from '@/lib/dsa/company-patterns'

describe('COMPANY_PATTERNS', () => {
  it('maps Google to graph-heavy interview patterns', () => {
    expect(COMPANY_PATTERNS.Google).toContain('Graphs')
  })

  it('matches companies case-insensitively', () => {
    expect(getCompanyPatterns('google cloud')).toEqual(COMPANY_PATTERNS.Google)
  })
})
