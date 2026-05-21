import { describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function MockAnthropic() {
    return { messages: { create: vi.fn() } }
  }),
}))

import { buildInterviewKitPrompt } from '@/lib/llm/interview-kit'

describe('buildInterviewKitPrompt', () => {
  it('includes all required sections and handles missing job descriptions', () => {
    const prompt = buildInterviewKitPrompt({
      companyName: 'Acme',
      companyDescription: null,
      roleTitle: 'Software Engineer',
      jobDescription: null,
      fullName: 'Kenny',
      currentTitle: null,
      yearsExperience: null,
      skills: null,
      starStories: [],
    })

    expect(prompt).toContain('Job description: Not available')
    expect(prompt).toContain('1. **Company**')
    expect(prompt).toContain('2. **Likely behavioral questions**')
    expect(prompt).toContain('3. **Your strongest stories**')
    expect(prompt).toContain('4. **Questions to ask**')
    expect(prompt).toContain('5. **One thing NOT to say**')
  })
})
