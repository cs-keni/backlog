import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { filterRelevantEntries, filterRelevantJobs } from '../../src/jobs/relevance-filter'
import { makeRawEntry, makeNormalizedJob } from '../fixtures/jobs'

describe('filterRelevantEntries — title blocklist', () => {
  it('blocks "Senior Software Engineer"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Senior Software Engineer' })])
    expect(result).toHaveLength(0)
  })

  it('blocks "Staff Engineer"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Staff Engineer' })])
    expect(result).toHaveLength(0)
  })

  it('blocks "Principal SWE"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Principal SWE' })])
    expect(result).toHaveLength(0)
  })

  it('blocks "Tech Lead"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Tech Lead' })])
    expect(result).toHaveLength(0)
  })

  it('blocks "Engineering Manager"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Engineering Manager' })])
    expect(result).toHaveLength(0)
  })

  it('blocks "PhD Machine Learning Researcher"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'PhD Machine Learning Researcher' })])
    expect(result).toHaveLength(0)
  })

  it('blocks "Account Executive"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Account Executive' })])
    expect(result).toHaveLength(0)
  })

  it('blocks "Product Marketing Manager"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Product Marketing Manager' })])
    expect(result).toHaveLength(0)
  })

  it('blocks title containing "Intern"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Software Engineer Intern' })])
    expect(result).toHaveLength(0)
  })

  it('blocks title containing "Co-op"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Software Co-op' })])
    expect(result).toHaveLength(0)
  })
})

describe('filterRelevantEntries — location blocklist', () => {
  it('blocks location "London, UK"', () => {
    const result = filterRelevantEntries([makeRawEntry({ location: 'London, UK' })])
    expect(result).toHaveLength(0)
  })

  it('blocks location "Toronto, Canada"', () => {
    const result = filterRelevantEntries([makeRawEntry({ location: 'Toronto, Canada' })])
    expect(result).toHaveLength(0)
  })
})

describe('filterRelevantEntries — allowlist', () => {
  it('allows "Software Engineer"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Software Engineer' })])
    expect(result).toHaveLength(1)
  })

  it('allows "Product Manager"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Product Manager' })])
    expect(result).toHaveLength(1)
  })

  it('allows "Technical Program Manager"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'Technical Program Manager' })])
    expect(result).toHaveLength(1)
  })

  it('allows "New Grad Software Engineer"', () => {
    const result = filterRelevantEntries([makeRawEntry({ title: 'New Grad Software Engineer' })])
    expect(result).toHaveLength(1)
  })

  it('allows location "Remote"', () => {
    const result = filterRelevantEntries([makeRawEntry({ location: 'Remote' })])
    expect(result).toHaveLength(1)
  })

  it('allows location "San Francisco, CA"', () => {
    const result = filterRelevantEntries([makeRawEntry({ location: 'San Francisco, CA' })])
    expect(result).toHaveLength(1)
  })

  it('allows blank location (US default assumption)', () => {
    const result = filterRelevantEntries([makeRawEntry({ location: '' })])
    expect(result).toHaveLength(1)
  })
})

describe('filterRelevantEntries — log output', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => { consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) })
  afterEach(() => consoleSpy.mockRestore())

  it('logs correct drop count', () => {
    const entries = [
      makeRawEntry({ title: 'Software Engineer' }),
      makeRawEntry({ title: 'Senior Software Engineer' }),
      makeRawEntry({ title: 'Staff Engineer' }),
    ]
    filterRelevantEntries(entries)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Dropped 2/3'))
  })
})

describe('filterRelevantJobs', () => {
  it('blocks Senior from normalized jobs', () => {
    const result = filterRelevantJobs([makeNormalizedJob({ title: 'Senior Backend Engineer' })])
    expect(result).toHaveLength(0)
  })

  it('blocks jobs with non-US country', () => {
    const result = filterRelevantJobs([makeNormalizedJob({ country: 'United Kingdom', location: 'London' })])
    expect(result).toHaveLength(0)
  })

  it('allows US jobs', () => {
    const result = filterRelevantJobs([makeNormalizedJob({ country: 'United States' })])
    expect(result).toHaveLength(1)
  })

  it('allows null country with US location', () => {
    const result = filterRelevantJobs([makeNormalizedJob({ country: null, location: 'Austin, TX' })])
    expect(result).toHaveLength(1)
  })
})
