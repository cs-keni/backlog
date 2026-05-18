import { describe, it, expect } from 'vitest'
import { getBraveSearchQueries, isLessThanThreeYears, isLikelyJobUrl } from '../../src/search/brave'

describe('getBraveSearchQueries', () => {
  it('prioritizes broad career queries that produced candidates in production logs', () => {
    const queries = getBraveSearchQueries(2)
    expect(queries).toEqual([
      '"associate software engineer" "careers"',
      '"early career software engineer" "careers"',
    ])
  })

  it('includes Portland-specific discovery in the default budget', () => {
    const queries = getBraveSearchQueries(8)
    expect(queries.some((query) => query.includes('"Portland"'))).toBe(true)
    expect(queries.filter((query) => query.includes('"Portland"'))).toHaveLength(3)
  })

  it('keeps lower-yield quoted ATS queries outside the default budget', () => {
    const queries = getBraveSearchQueries(8)
    expect(queries).not.toContain('site:jobs.lever.co "new grad software engineer"')
    expect(queries).not.toContain('site:boards.greenhouse.io "new grad software engineer"')
  })
})

describe('isLessThanThreeYears', () => {
  it('allows explicit new grad roles', () => {
    expect(isLessThanThreeYears('New Grad Software Engineer. 0-2 years of experience.')).toBe(true)
  })

  it('allows junior roles without a years requirement', () => {
    expect(isLessThanThreeYears('Junior Backend Engineer working on APIs.')).toBe(true)
  })

  it('blocks 3+ year minimum requirements', () => {
    expect(isLessThanThreeYears('Requirements: at least 3 years of professional software experience.')).toBe(false)
  })

  it('blocks higher professional experience requirements', () => {
    expect(isLessThanThreeYears('You have 5+ years of software development experience.')).toBe(false)
  })

  it('does not let junior wording override a 3+ year minimum', () => {
    expect(isLessThanThreeYears('Junior Software Engineer. Minimum 3 years of professional experience.')).toBe(false)
  })
})

describe('isLikelyJobUrl', () => {
  it('allows direct ATS job URLs with job language', () => {
    const result = { title: 'Associate Software Engineer', description: 'Apply for this role.' }
    expect(isLikelyJobUrl('https://jobs.lever.co/acme/abc123', result)).toBe(true)
  })

  it('allows direct Greenhouse job-board URLs', () => {
    const result = { title: 'New Grad Software Engineer', description: 'Careers opening.' }
    expect(isLikelyJobUrl('https://job-boards.greenhouse.io/acme/jobs/12345', result)).toBe(true)
  })

  it('allows company careers job paths', () => {
    const result = { title: 'Junior Software Engineer', description: 'Entry level job opening.' }
    expect(isLikelyJobUrl('https://example.com/careers/software-engineer-new-grad', result)).toBe(true)
  })

  it('blocks broad job-board result pages', () => {
    const result = { title: 'Junior Software Engineer Jobs', description: 'Many listings.' }
    expect(isLikelyJobUrl('https://www.indeed.com/jobs?q=junior+software+engineer', result)).toBe(false)
  })

  it('blocks non-job pages', () => {
    const result = { title: 'How to become a software engineer', description: 'Guide.' }
    expect(isLikelyJobUrl('https://example.com/blog/software-engineer-guide', result)).toBe(false)
  })
})
