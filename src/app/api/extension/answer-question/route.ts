import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are helping a job applicant answer an open-ended application question.
Write a concise, professional answer (2–4 sentences) based on the applicant's profile.
Focus on concrete facts from their background. Do not fabricate experiences or skills they don't have.
Return only the answer text — no greeting, no preamble, no explanation.`

function buildUserPrompt(
  question: string,
  profile: {
    full_name: string | null
    experience_level: string | null
    years_of_experience: number | null
    skills: string[] | null
    workHistory: Array<{ company: string; title: string; description: string | null }>
    starResponses: Array<{ question: string; full_response: string | null }>
  }
): string {
  const lines: string[] = [
    `Question: "${question}"`,
    '',
    'Applicant profile:',
    `- Name: ${profile.full_name ?? 'Not provided'}`,
    `- Experience level: ${profile.experience_level ?? 'Not specified'}`,
    `- Years of experience: ${profile.years_of_experience ?? 'Not specified'}`,
    `- Skills: ${profile.skills?.join(', ') || 'Not listed'}`,
  ]

  if (profile.workHistory.length > 0) {
    lines.push('', 'Work history:')
    for (const job of profile.workHistory.slice(0, 3)) {
      lines.push(`- ${job.title} at ${job.company}${job.description ? `: ${job.description.slice(0, 200)}` : ''}`)
    }
  }

  if (profile.starResponses.length > 0) {
    lines.push('', 'Relevant example responses (for context):')
    for (const star of profile.starResponses.slice(0, 2)) {
      if (star.full_response) {
        lines.push(`Q: "${star.question}"`)
        lines.push(`A: "${star.full_response.slice(0, 300)}"`)
      }
    }
  }

  lines.push('', 'Write the answer:')
  return lines.join('\n')
}

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let question: string
  try {
    const body = await request.json() as { question?: unknown }
    if (typeof body.question !== 'string' || !body.question.trim()) {
      return Response.json({ error: 'question is required' }, { status: 400 })
    }
    question = body.question.trim()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── 1. Check saved_answers for a match ────────────────────────────────────
  // Simple semantic match: check if any saved question is a substring of the
  // new question or vice versa (handles minor phrasing variations).
  const { data: savedAnswers } = await supabase
    .from('saved_answers')
    .select('question, answer')
    .eq('user_id', auth.userId)

  if (savedAnswers) {
    const qLower = question.toLowerCase()
    for (const saved of savedAnswers) {
      const savedLower = (saved.question as string).toLowerCase()
      // Match if at least 60% of saved question words appear in the new question
      const savedWords = savedLower.split(/\s+/).filter(w => w.length > 3)
      if (savedWords.length > 0) {
        const matchCount = savedWords.filter(w => qLower.includes(w)).length
        if (matchCount / savedWords.length >= 0.6) {
          return Response.json({ answer: saved.answer, source: 'saved' })
        }
      }
    }
  }

  // ── 2. Fetch profile + STAR responses for Sonnet context ──────────────────
  const [userResult, workResult, starResult] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, experience_level, years_of_experience, skills')
      .eq('id', auth.userId)
      .single(),
    supabase
      .from('work_history')
      .select('company, title, description')
      .eq('user_id', auth.userId)
      .order('display_order')
      .limit(3),
    supabase
      .from('star_responses')
      .select('question, full_response')
      .eq('user_id', auth.userId)
      .not('full_response', 'is', null)
      .limit(2),
  ])

  const profile = {
    full_name: userResult.data?.full_name ?? null,
    experience_level: userResult.data?.experience_level ?? null,
    years_of_experience: userResult.data?.years_of_experience ?? null,
    skills: userResult.data?.skills ?? null,
    workHistory: (workResult.data ?? []) as Array<{ company: string; title: string; description: string | null }>,
    starResponses: (starResult.data ?? []) as Array<{ question: string; full_response: string | null }>,
  }

  // ── 3. Call Sonnet ────────────────────────────────────────────────────────
  const client = new Anthropic()

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(question, profile) }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return Response.json({ error: 'Unexpected response from AI' }, { status: 500 })
    }

    return Response.json({ answer: content.text.trim(), source: 'generated' })
  } catch (err) {
    console.error('[answer-question] Sonnet error:', err)
    return Response.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
