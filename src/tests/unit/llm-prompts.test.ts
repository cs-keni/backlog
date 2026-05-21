import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreate, mockVerifyApiKey, mockSupabaseJsCreateClient } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockVerifyApiKey: vi.fn(),
  mockSupabaseJsCreateClient: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function MockAnthropic() {
    return { messages: { create: mockCreate } }
  }),
}))

vi.mock('@/lib/auth/api-key', () => ({
  verifyApiKeyFromRequest: mockVerifyApiKey,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockSupabaseJsCreateClient,
}))

import { buildStarResponse } from '@/lib/llm/star-builder'
import { generateCoverLetter } from '@/lib/llm/cover-letter'
import { generateInterviewGuide } from '@/lib/llm/question-generator'
import { POST as answerQuestionPOST } from '@/app/api/extension/answer-question/route'

function anthropicText(text: string) {
  return { content: [{ type: 'text', text }] }
}

function makeSupabaseForAnswerQuestion() {
  const responses: Record<string, unknown> = {
    saved_answers: [],
    extension_answer_cache: null,
    users: {
      full_name: 'Kenny Nguyen',
      experience_level: 'entry',
      years_of_experience: 1,
      skills: ['TypeScript', 'React'],
    },
    work_history: [
      { company: 'Backlog Labs', title: 'Frontend Engineer', description: 'Built React automation tools.' },
    ],
    star_responses: [
      { question: 'Tell me about a project', full_response: 'I shipped a workflow tool with measurable adoption.' },
    ],
  }

  return {
    from(table: keyof typeof responses) {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        not: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        maybeSingle: vi.fn(() => Promise.resolve({ data: responses[table], error: null })),
        single: vi.fn(() => Promise.resolve({ data: responses[table], error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        then(resolve: (value: { data: unknown; error: null }) => void) {
          return Promise.resolve({ data: responses[table], error: null }).then(resolve)
        },
      }
      return chain
    },
  }
}

describe('LLM prompt shape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyApiKey.mockResolvedValue({ userId: 'user-1' })
    mockSupabaseJsCreateClient.mockReturnValue(makeSupabaseForAnswerQuestion())
  })

  it('sends STAR builder context with question, skills, and work history', async () => {
    mockCreate.mockResolvedValueOnce(anthropicText(JSON.stringify({
      situation: 'Situation',
      task: 'Task',
      action: 'Action',
      result: 'Result',
    })))

    await buildStarResponse(
      'Tell me about improving a shared frontend system.',
      'Kenny Nguyen',
      ['TypeScript', 'React'],
      [{
        company: 'Backlog Labs',
        title: 'Frontend Engineer',
        start_date: '2025-01-01',
        end_date: null,
        is_current: true,
        description: 'Built reusable dashboard primitives.',
      }],
    )

    const payload = mockCreate.mock.calls[0]![0]
    expect(payload.model).toBe('claude-sonnet-4-6')
    expect(payload.messages).toHaveLength(1)
    expect(payload.messages[0].content).toContain('Tell me about improving a shared frontend system.')
    expect(payload.messages[0].content).toContain('Frontend Engineer at Backlog Labs')
    expect(payload.messages[0].content).toContain('Skills: TypeScript, React')
    expect(payload.messages[0].content).toContain('STAR-format')
    expect(payload.messages[0].content).toContain('Respond with JSON only')
  })

  it('sends cover-letter prompt with job, profile, and explicit template guidance', async () => {
    mockCreate.mockResolvedValueOnce(anthropicText(JSON.stringify({
      template_type: 'startup',
      content: 'Letter body',
    })))

    await generateCoverLetter(
      'Resume text with TypeScript and React delivery experience.',
      [{
        company: 'Backlog Labs',
        title: 'Frontend Engineer',
        start_date: '2025-01-01',
        end_date: null,
        is_current: true,
        description: 'Owned frontend systems.',
      }],
      'Product Engineer',
      'Acme Robotics',
      'Build React tools for warehouse operations.',
      ['TypeScript', 'React'],
      'Kenny Nguyen',
      'startup',
    )

    const content = mockCreate.mock.calls[0]![0].messages[0].content
    expect(content).toContain('Title: Product Engineer')
    expect(content).toContain('Company: Acme Robotics')
    expect(content).toContain('Build React tools for warehouse operations.')
    expect(content).toContain('CANDIDATE: Kenny Nguyen')
    expect(content).toContain('Use the "startup" template style')
  })

  it('sends interview-guide prompt with company and recent job context', async () => {
    mockCreate.mockResolvedValueOnce(anthropicText(JSON.stringify({
      overview: 'Process overview',
      rounds: [{ name: 'Technical', focus: 'Frontend systems' }],
      behavioral_questions: [{ question: 'Tell me about ambiguity.', hint: 'Use STAR.' }],
      technical_questions: [{ question: 'Design a dashboard.', hint: 'Discuss tradeoffs.', topics: ['React'] }],
      cultural_signals: { values: ['Customer empathy'], terminology: ['throughput'], avoid: ['vague impact'] },
      questions_to_ask: ['How do engineers validate workflows?'],
    })))

    await generateInterviewGuide('Acme Robotics', [
      { title: 'Frontend Platform Engineer', description: 'React, TypeScript, dashboards.' },
    ])

    const content = mockCreate.mock.calls[0]![0].messages[0].content
    expect(content).toContain('Acme Robotics')
    expect(content).toContain('Role 1: Frontend Platform Engineer')
    expect(content).toContain('React, TypeScript, dashboards.')
    expect(content).toContain('Generate a structured interview guide')
  })

  it('sends extension answer-question prompt with normalized profile context on cache miss', async () => {
    mockCreate.mockResolvedValueOnce(anthropicText('I would focus on concrete frontend automation impact.'))

    const res = await answerQuestionPOST(new Request('http://localhost/api/extension/answer-question', {
      method: 'POST',
      body: JSON.stringify({ question: 'Why are you interested in this role?' }),
    }))

    expect(res.status).toBe(200)
    const payload = mockCreate.mock.calls[0]![0]
    expect(payload.system).toContain('open-ended application question')
    expect(payload.messages[0].content).toContain('Why are you interested in this role?')
    expect(payload.messages[0].content).toContain('Kenny Nguyen')
    expect(payload.messages[0].content).toContain('Frontend Engineer at Backlog Labs')
    expect(payload.messages[0].content).toContain('I shipped a workflow tool')
  })
})
