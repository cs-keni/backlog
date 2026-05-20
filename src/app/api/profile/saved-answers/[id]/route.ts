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

  const updates: Record<string, unknown> = {}
  if (body.question !== undefined) updates.question = body.question
  if (body.answer !== undefined) updates.answer = body.answer

  const { data: ownerRow, error: ownerError } = await supabase
    .from('saved_answers')
    .select('user_id')
    .eq('id', id)
    .single()
  if (ownerError || !ownerRow) return Response.json({ error: 'Not found' }, { status: 404 })
  if (ownerRow.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('saved_answers')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return Response.json({ error: 'Update failed' }, { status: 500 })
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
    .from('saved_answers')
    .select('user_id')
    .eq('id', id)
    .single()
  if (ownerError || !ownerRow) return Response.json({ error: 'Not found' }, { status: 404 })
  if (ownerRow.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('saved_answers')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: 'Delete failed' }, { status: 500 })
  return new Response(null, { status: 204 })
}
