export const maxDuration = 30

import { createClient } from '@/lib/supabase/server'
import { buildStarResponse } from '@/lib/llm/star-builder'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')

  let query = supabase
    .from('star_responses')
    .select('id, company_id, question, situation, task, action, result, full_response, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/star-responses]', error)
    return Response.json({ error: 'Failed to fetch responses' }, { status: 500 })
  }

  return Response.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { company_id?: string | null; question?: string; generate?: boolean }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.question) {
    return Response.json({ error: 'question is required' }, { status: 400 })
  }

  let situation = ''
  let task = ''
  let action = ''
  let result = ''
  let full_response = ''

  if (body.generate) {
    const [profileResult, workResult] = await Promise.all([
      supabase
        .from('users')
        .select('full_name, skills')
        .eq('id', user.id)
        .single(),
      supabase
        .from('work_history')
        .select('company, title, start_date, end_date, is_current, description')
        .eq('user_id', user.id)
        .order('display_order'),
    ])

    const star = await buildStarResponse(
      body.question,
      profileResult.data?.full_name ?? 'the candidate',
      profileResult.data?.skills ?? [],
      workResult.data ?? [],
    )

    situation = star.situation
    task = star.task
    action = star.action
    result = star.result
    full_response = star.full_response
  }

  const { data, error } = await supabase
    .from('star_responses')
    .insert({
      user_id: user.id,
      company_id: body.company_id ?? null,
      question: body.question,
      situation: situation || null,
      task: task || null,
      action: action || null,
      result: result || null,
      full_response: full_response || null,
    })
    .select('id, company_id, question, situation, task, action, result, full_response, created_at, updated_at')
    .single()

  if (error || !data) {
    console.error('[POST /api/star-responses]', error)
    return Response.json({ error: 'Failed to create response' }, { status: 500 })
  }

  return Response.json(data)
}
