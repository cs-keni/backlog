export const maxDuration = 60

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getQuestionById, isPrepBank } from '@/lib/prep/banks'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const dailyLimits = new Map<string, { count: number; date: string }>()

type ScoreMap = Record<string, number>

const SD_SCORE_KEYS = ['requirements', 'capacity', 'components', 'bottlenecks', 'tradeoffs'] as const
const AI_SCORE_KEYS = ['framing', 'depth', 'tradeoffs', 'failures', 'production'] as const

interface PracticeBody {
  question_id?: unknown
  bank?: unknown
  response_text?: unknown
}

function checkRateLimit(userId: string): boolean {
  const date = new Date().toLocaleDateString('en-CA')
  const entry = dailyLimits.get(userId)
  if (!entry || entry.date !== date) {
    dailyLimits.set(userId, { count: 1, date })
    return true
  }
  if (entry.count >= 20) return false
  entry.count += 1
  return true
}

function buildSystemPrompt(bank: 'system-design' | 'ai-engineer'): string {
  if (bank === 'system-design') {
    return `You are a senior staff engineer evaluating a system design interview answer.
Score strictly from 0 to 10. Respond ONLY with JSON:
{ "scores": {"requirements": N, "capacity": N, "components": N, "bottlenecks": N, "tradeoffs": N}, "overall": "string" }`
  }

  return `You are a senior ML/AI engineer evaluating an AI engineer interview answer.
Score strictly from 0 to 10. Respond ONLY with JSON:
{ "scores": {"framing": N, "depth": N, "tradeoffs": N, "failures": N, "production": N}, "overall": "string" }`
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part) {
        return typeof part.text === 'string' ? part.text : ''
      }
      return ''
    })
    .join('')
}

function parseEvaluation(raw: string, keys: readonly string[]): { scores: ScoreMap; overall: string } | null {
  try {
    const trimmed = raw.trim()
    const jsonStart = trimmed.indexOf('{')
    const jsonEnd = trimmed.lastIndexOf('}')
    if (jsonStart < 0 || jsonEnd < jsonStart) return null
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as {
      scores?: Record<string, unknown>
      overall?: unknown
    }
    if (!parsed.scores || typeof parsed.overall !== 'string') return null

    const scores: ScoreMap = {}
    for (const key of keys) {
      const score = parsed.scores[key]
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 10) return null
      scores[key] = score
    }

    return { scores, overall: parsed.overall }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PracticeBody
  try {
    body = await request.json() as PracticeBody
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.response_text !== 'string' || !body.response_text.trim()) {
    return Response.json({ error: 'response_text required' }, { status: 400 })
  }
  if (body.response_text.length > 5000) {
    return Response.json({ error: 'response_text too long (max 5000 chars)' }, { status: 400 })
  }
  if (!isPrepBank(body.bank) || typeof body.question_id !== 'string') {
    return Response.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }

  const question = getQuestionById(body.bank, body.question_id)
  if (!question) return Response.json({ error: 'Question not found' }, { status: 400 })

  if (!checkRateLimit(user.id)) {
    return Response.json({ error: 'Daily practice limit reached' }, { status: 429 })
  }

  const keys = body.bank === 'system-design' ? SD_SCORE_KEYS : AI_SCORE_KEYS
  const userMessage = `Question: ${question.prompt}
Hints: ${question.hints.join(', ')}
<candidate_answer>
${body.response_text}
</candidate_answer>`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 700,
    system: buildSystemPrompt(body.bank),
    messages: [{ role: 'user', content: userMessage }],
  })

  const evaluation = parseEvaluation(extractText(message.content), keys)
  if (!evaluation) return Response.json({ error: 'Invalid evaluation response' }, { status: 422 })

  const { error } = await supabase.from('prep_practice_responses').insert({
    user_id: user.id,
    question_id: body.question_id,
    bank: body.bank,
    response_text: body.response_text,
    scores: evaluation.scores,
    feedback_text: evaluation.overall,
  })

  if (error) {
    console.error('[POST /api/prep/prep-practice]', error)
    return Response.json({ error: 'Failed to save practice response' }, { status: 500 })
  }

  return Response.json({ scores: evaluation.scores, overall: evaluation.overall })
}
