import { describe, expect, it } from 'vitest'
import { getSpotlightQuestions } from '@/lib/prep/spotlight-logic'
import type { PrepQuestion } from '@/lib/prep/prep-types'

const baseQuestion: PrepQuestion = {
  id: 'sd-001',
  topic: 'caching',
  difficulty: 'mid',
  prompt: 'Design a cache',
  hints: ['TTL'],
  concepts: ['cache-aside-pattern'],
}

describe('getSpotlightQuestions', () => {
  it('matches company tags against active application companies', () => {
    const questions: PrepQuestion[] = [
      { ...baseQuestion, id: 'sd-001', companies: ['netflix'] },
      { ...baseQuestion, id: 'sd-002', companies: ['stripe'] },
    ]

    const result = getSpotlightQuestions(['Netflix Streaming'], questions)

    expect(result.map((question) => question.id)).toEqual(['sd-001'])
  })

  it('ignores short ambiguous company tags and caps results at five', () => {
    const questions = Array.from({ length: 8 }, (_, index): PrepQuestion => ({
      ...baseQuestion,
      id: `sd-${String(index + 1).padStart(3, '0')}`,
      companies: index === 0 ? ['meta'] : ['cloudflare'],
    }))

    const result = getSpotlightQuestions(['Cloudflare'], questions)

    expect(result).toHaveLength(5)
    expect(result.some((question) => question.companies?.includes('meta'))).toBe(false)
  })
})
