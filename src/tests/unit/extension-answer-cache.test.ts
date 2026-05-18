import { describe, expect, it } from 'vitest'
import { normalizeQuestionForCache } from '@/app/api/extension/answer-question/route'

describe('normalizeQuestionForCache', () => {
  it('normalizes punctuation, casing, and whitespace', () => {
    expect(normalizeQuestionForCache(' Why do you want to work HERE?  ')).toBe('why do you want to work here')
  })

  it('keeps meaningful numbers for experience questions', () => {
    expect(normalizeQuestionForCache('Describe your 0-2 years of React experience.')).toBe(
      'describe your 0 2 years of react experience'
    )
  })
})
