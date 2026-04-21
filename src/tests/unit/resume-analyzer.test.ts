import { describe, it, expect, vi, afterEach } from 'vitest'

// Hoist so mock factory can reference it
const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } }
  },
}))

import { analyzeResume } from '@/lib/llm/resume-analyzer'

function makeLlmResponse(override: Record<string, unknown> = {}) {
  return {
    choices: [{
      message: {
        content: JSON.stringify({
          personal_info: {
            full_name: 'Jane Doe',
            phone: '5035551234',
            address: 'Portland, OR',
            linkedin_url: 'https://linkedin.com/in/janedoe',
            github_url: 'https://github.com/janedoe',
            portfolio_url: 'https://janedoe.dev',
          },
          skills: ['TypeScript', 'React', 'PostgreSQL'],
          work_history: [{
            company: 'Startup Inc',
            title: 'Software Engineer',
            start_date: '2023-06-01',
            end_date: null,
            is_current: true,
            description: '• Built features\n• Shipped things',
          }],
          education: [{
            school: 'State University',
            degree: 'Bachelor of Science',
            field_of_study: 'Computer Science',
            graduation_year: 2023,
            gpa: 3.85,
          }],
          qa_pairs: [{ question: 'Tell me about yourself.', answer: 'I am a software engineer.' }],
          ...override,
        }),
      },
    }],
  }
}

describe('analyzeResume', () => {
  afterEach(() => vi.clearAllMocks())

  it('extracts linkedin_url, github_url, portfolio_url from LLM JSON', async () => {
    mockCreate.mockResolvedValueOnce(makeLlmResponse())
    const result = await analyzeResume('Jane Doe resume text here...')
    expect(result.personal_info.linkedin_url).toBe('https://linkedin.com/in/janedoe')
    expect(result.personal_info.github_url).toBe('https://github.com/janedoe')
    expect(result.personal_info.portfolio_url).toBe('https://janedoe.dev')
  })

  it('extracts gpa from education entry', async () => {
    mockCreate.mockResolvedValueOnce(makeLlmResponse())
    const result = await analyzeResume('resume text')
    expect(result.education[0].gpa).toBe(3.85)
  })

  it('preserves work history description with bullet points as-is', async () => {
    mockCreate.mockResolvedValueOnce(makeLlmResponse())
    const result = await analyzeResume('resume text')
    expect(result.work_history[0].description).toBe('• Built features\n• Shipped things')
  })

  it('coerces null fields when LLM returns undefined for portfolio_url', async () => {
    mockCreate.mockResolvedValueOnce(makeLlmResponse({
      personal_info: {
        full_name: 'Jane Doe',
        phone: null,
        address: null,
        linkedin_url: null,
        github_url: null,
        // portfolio_url intentionally absent (undefined)
      },
    }))
    const result = await analyzeResume('resume text')
    expect(result.personal_info.portfolio_url).toBeNull()
  })

  it('coerces null gpa when LLM omits it', async () => {
    mockCreate.mockResolvedValueOnce(makeLlmResponse({
      education: [{
        school: 'State University',
        degree: 'BS',
        field_of_study: 'CS',
        graduation_year: 2023,
        // gpa intentionally absent
      }],
    }))
    const result = await analyzeResume('resume text')
    expect(result.education[0].gpa).toBeNull()
  })

  it('returns qa_pairs array from LLM output', async () => {
    mockCreate.mockResolvedValueOnce(makeLlmResponse())
    const result = await analyzeResume('resume text')
    expect(result.qa_pairs).toHaveLength(1)
    expect(result.qa_pairs[0].question).toBe('Tell me about yourself.')
  })
})
