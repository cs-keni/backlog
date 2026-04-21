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
  if (typeof body.name === 'string') updates.name = body.name
  if ('description' in body) updates.description = typeof body.description === 'string' ? body.description || null : null
  if ('role' in body) updates.role = typeof body.role === 'string' ? body.role || null : null
  if (Array.isArray(body.tech_stack)) updates.tech_stack = body.tech_stack
  if ('url' in body) updates.url = typeof body.url === 'string' ? body.url || null : null
  if (Array.isArray(body.highlights)) updates.highlights = body.highlights
  if ('start_date' in body) updates.start_date = typeof body.start_date === 'string' ? body.start_date || null : null
  if ('end_date' in body) updates.end_date = typeof body.end_date === 'string' ? body.end_date || null : null
  if ('is_current' in body) updates.is_current = body.is_current === true

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    console.error('[PATCH /api/profile/projects/[id]]', error)
    return Response.json({ error: 'Update failed' }, { status: 500 })
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

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[DELETE /api/profile/projects/[id]]', error)
    return Response.json({ error: 'Delete failed' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
