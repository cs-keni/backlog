import { createClient } from '@/lib/supabase/server'
import { hasE2EAuthCookie } from '@/lib/e2e/server'
import { e2eStarResponse } from '@/lib/e2e/fixtures'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (hasE2EAuthCookie(request)) {
    const body = await request.json().catch(() => ({})) as {
      situation?: string
      task?: string
      action?: string
      result?: string
    }
    const response = e2eStarResponse('Tell me about a time you improved a shared frontend system without slowing product delivery.')
    return Response.json({ ...response, ...body, updated_at: new Date().toISOString() })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: { situation?: string; task?: string; action?: string; result?: string }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const situation = body.situation ?? ''
  const task = body.task ?? ''
  const action = body.action ?? ''
  const result = body.result ?? ''

  const full_response = [
    `Situation: ${situation}`,
    `Task: ${task}`,
    `Action: ${action}`,
    `Result: ${result}`,
  ].join('\n\n')

  const { data, error } = await supabase
    .from('star_responses')
    .update({
      situation,
      task,
      action,
      result,
      full_response,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, company_id, question, situation, task, action, result, full_response, created_at, updated_at')
    .single()

  if (error || !data) {
    console.error('[PATCH /api/star-responses/[id]]', error)
    return Response.json({ error: 'Failed to update response' }, { status: 500 })
  }

  return Response.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (hasE2EAuthCookie(request)) {
    return new Response(null, { status: 204 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('star_responses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[DELETE /api/star-responses/[id]]', error)
    return Response.json({ error: 'Failed to delete response' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
