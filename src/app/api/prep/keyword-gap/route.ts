export const maxDuration = 30

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildKeywordGapPrompt, normalizeKeywordGaps } from '@/lib/llm/keyword-gap'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const applicationId = new URL(request.url).searchParams.get('application_id')
  if (!applicationId) return Response.json({ error: 'application_id required' }, { status: 400 })

  const { data } = await supabase
    .from('keyword_gaps')
    .select('id, gaps, generated_at')
    .eq('application_id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle()

  return Response.json(data ?? null)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { application_id?: unknown } | null
  if (!body || typeof body.application_id !== 'string') {
    return Response.json({ error: 'application_id required' }, { status: 400 })
  }

  const [appResult, profileResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, jobs(description)')
      .eq('id', body.application_id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('users')
      .select('resume_text')
      .eq('id', user.id)
      .single(),
  ])

  if (!appResult.data) return Response.json({ error: 'Application not found' }, { status: 404 })

  const jobs = appResult.data.jobs as { description?: string | null } | { description?: string | null }[] | null
  const jobDescription = Array.isArray(jobs) ? jobs[0]?.description : jobs?.description
  const resumeText = profileResult.data?.resume_text
  if (!jobDescription || !resumeText) {
    return Response.json({ error: 'Resume or job description missing' }, { status: 422 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: buildKeywordGapPrompt(resumeText, jobDescription) }],
  })

  const text = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
  let gaps
  try {
    gaps = normalizeKeywordGaps(JSON.parse(text))
  } catch {
    return Response.json({ error: 'Failed to parse LLM response' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('keyword_gaps')
    .upsert(
      { application_id: body.application_id, user_id: user.id, gaps, generated_at: new Date().toISOString() },
      { onConflict: 'application_id,user_id' }
    )
    .select('id, gaps, generated_at')
    .single()

  if (error) {
    console.error('[POST /api/prep/keyword-gap]', error)
    return Response.json({ error: 'Failed to save gap analysis' }, { status: 500 })
  }

  return Response.json(data)
}
