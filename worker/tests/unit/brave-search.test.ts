import { describe, it, expect } from 'vitest'
import { isLessThanThreeYears, isLikelyJobUrl } from '../../src/search/brave'

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
