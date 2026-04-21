import { describe, it, expect, vi, afterEach } from 'vitest'

// Hoist mock functions so they're available when vi.mock factory runs
const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } }
  },
}))

import { computeMatchScore } from '@/lib/llm/matcher'

describe('computeMatchScore — skills-only mode', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns mode "none" when both skills and resume are absent', async () => {
    const result = await computeMatchScore({
      skills: null,
      resumeText: null,
      jobTags: ['typescript'],
      jobDescription: null,
      jobTitle: 'SWE',
      company: 'Acme',
    })
    expect(result.mode).toBe('none')
    expect(result.score).toBe(0)
  })

  it('returns mode "skills" and correct Jaccard when no resume', async () => {
    const result = await computeMatchScore({
      skills: ['typescript', 'react', 'node'],
      resumeText: null,
      jobTags: ['typescript', 'react', 'python'],
      jobDescription: null,
      jobTitle: 'SWE',
      company: 'Acme',
    })
    expect(result.mode).toBe('skills')
    // intersection: typescript, react = 2 / union: typescript, react, node, python = 4 → 50
    expect(result.score).toBe(50)
    expect(result.rationale).toBeNull()
    expect(result.dimensions).toBeNull()
  })

  it('returns 0 score for no skill overlap', async () => {
    const result = await computeMatchScore({
      skills: ['cobol', 'fortran'],
      resumeText: null,
      jobTags: ['typescript', 'react'],
      jobDescription: null,
      jobTitle: 'SWE',
      company: 'Acme',
    })
    expect(result.score).toBe(0)
  })

  it('returns 100 score for perfect skill overlap', async () => {
    const result = await computeMatchScore({
      skills: ['typescript', 'react'],
      resumeText: null,
      jobTags: ['typescript', 'react'],
      jobDescription: null,
      jobTitle: 'SWE',
      company: 'Acme',
    })
    expect(result.score).toBe(100)
  })

  it('returns mode "skills" when skills present but resume is too short', async () => {
    const result = await computeMatchScore({
      skills: ['typescript'],
      resumeText: 'short',
      jobTags: ['typescript'],
      jobDescription: null,
      jobTitle: 'SWE',
      company: 'Acme',
    })
    expect(result.mode).toBe('skills')
  })
})

describe('computeMatchScore — resume mode', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns mode "resume" and dimensions when resume is present', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            score: 75,
            rationale: 'Good TypeScript and React match.',
            dimensions: { role_fit: 80, tech_stack: 70, experience: 75, compensation: 50 },
          }),
        },
      }],
    })

    const result = await computeMatchScore({
      skills: ['typescript'],
      resumeText: 'A'.repeat(100),
      jobTags: ['typescript', 'react'],
      jobDescription: 'Build great products.',
      jobTitle: 'SWE',
      company: 'Acme',
    })
    expect(result.mode).toBe('resume')
    expect(result.score).toBe(75)
    expect(result.dimensions).not.toBeNull()
    expect(result.dimensions).toMatchObject({
      role_fit: expect.any(Number),
      tech_stack: expect.any(Number),
      experience: expect.any(Number),
      compensation: expect.any(Number),
    })
  })
})
