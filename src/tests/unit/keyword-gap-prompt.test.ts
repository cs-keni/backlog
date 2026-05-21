import { describe, expect, it } from 'vitest'
import { buildKeywordGapPrompt, normalizeKeywordGaps } from '@/lib/llm/keyword-gap'

describe('keyword gap prompt', () => {
  it('includes bounded resume and job description text', () => {
    const prompt = buildKeywordGapPrompt('resume '.repeat(800), 'job '.repeat(800))

    expect(prompt).toContain('Return ONLY valid JSON')
    expect(prompt).toContain('"skills"')
    expect(prompt.length).toBeLessThan(6000)
  })

  it('normalizes malformed gap output', () => {
    expect(normalizeKeywordGaps({ skills: ['React', 1], tools: ['Datadog'], verbs: null })).toEqual({
      skills: ['React'],
      tools: ['Datadog'],
      verbs: [],
    })
  })
})
