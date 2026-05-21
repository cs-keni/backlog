import { describe, expect, it } from 'vitest'
import { computeActiveFeedbackFilters, isDismissReason } from '@/lib/feed/feedback-filters'

describe('feedback filters', () => {
  it('does not activate before five matching signals', () => {
    const filters = computeActiveFeedbackFilters([
      { reason: 'too_far' },
      { reason: 'too_far' },
      { reason: 'too_far' },
      { reason: 'too_far' },
    ])

    expect(filters.excludeTooFar).toBe(false)
    expect(filters.tooFarCount).toBe(4)
  })

  it('activates too far and wrong stack at five matching signals', () => {
    const filters = computeActiveFeedbackFilters([
      ...Array.from({ length: 5 }, () => ({ reason: 'too_far' })),
      ...Array.from({ length: 5 }, () => ({ reason: 'wrong_stack' })),
      ...Array.from({ length: 6 }, () => ({ reason: 'company_culture' })),
    ])

    expect(filters.excludeTooFar).toBe(true)
    expect(filters.excludeWrongStack).toBe(true)
  })

  it('validates dismiss reasons', () => {
    expect(isDismissReason('wrong_stack')).toBe(true)
    expect(isDismissReason('salary')).toBe(false)
  })
})
