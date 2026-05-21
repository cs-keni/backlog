import { describe, expect, it } from 'vitest'
import { computeAtsCompleteness } from '@/lib/tracker/ats-fields'
import { detectAtsPlatform } from '@/lib/tracker/ats-platform'

const completeProfile = {
  full_name: 'Kenny Nguyen',
  email: 'kenny@example.com',
  resume_text: 'resume',
  linkedin_url: 'https://linkedin.com/in/kenny',
  street_address: '1 Market St',
  phone: '555-555-5555',
  work_authorization: 'US citizen',
}

describe('detectAtsPlatform', () => {
  it('detects common ATS hosts', () => {
    expect(detectAtsPlatform('https://boards.greenhouse.io/acme/jobs/1')).toBe('greenhouse')
    expect(detectAtsPlatform('https://acme.wd5.myworkdayjobs.com/jobs')).toBe('workday')
    expect(detectAtsPlatform('https://jobs.lever.co/acme/1')).toBe('lever')
    expect(detectAtsPlatform('https://jobs.example.com/1')).toBe('unknown')
    expect(detectAtsPlatform(null)).toBeNull()
  })
})

describe('computeAtsCompleteness', () => {
  it('computes missing fields for workday', () => {
    const result = computeAtsCompleteness('workday', {
      ...completeProfile,
      phone: null,
      street_address: null,
    })

    expect(result).toEqual({
      score: 67,
      missing: ['Street address', 'Phone number'],
    })
  })

  it('returns null for null, unknown, or unsupported platforms', () => {
    expect(computeAtsCompleteness(null, completeProfile)).toBeNull()
    expect(computeAtsCompleteness('unknown', completeProfile)).toBeNull()
    expect(computeAtsCompleteness('jobvite', completeProfile)).toBeNull()
  })
})
