import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Normalize YYYY-MM (from <input type="month">) → YYYY-MM-01 for PostgreSQL date columns
  for (const key of ['start_date', 'end_date'] as const) {
    if (typeof body[key] === 'string' && /^\d{4}-\d{2}$/.test(body[key] as string)) {
      body[key] = (body[key] as string) + '-01'
    }
  }

  const allowed = ['company', 'title', 'location', 'start_date', 'end_date', 'is_current', 'description', 'display_order']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data: ownerRow, error: ownerError } = await supabase
    .from('work_history')
    .select('user_id')
    .eq('id', id)
    .single()
  if (ownerError || !ownerRow) return Response.json({ error: 'Not found' }, { status: 404 })
  if (ownerRow.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('work_history')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[PATCH /api/profile/work-history/:id]', error)
    return Response.json({ error: 'Update failed', detail: error.message }, { status: 500 })
  }
  return Response.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ownerRow, error: ownerError } = await supabase
    .from('work_history')
    .select('user_id')
    .eq('id', id)
    .single()
  if (ownerError || !ownerRow) return Response.json({ error: 'Not found' }, { status: 404 })
  if (ownerRow.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('work_history')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: 'Delete failed' }, { status: 500 })

  await supabase.from('match_scores').update({ is_stale: true }).eq('user_id', user.id)

  return new Response(null, { status: 204 })
}
