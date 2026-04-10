import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function GET(_req: Request, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('story_bank')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as {
    title?: string
    theme?: string
    situation?: string
    task?: string
    action?: string
    result?: string
    reflection?: string
    tags?: string[]
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined) updates.title = body.title.trim()
  if (body.theme !== undefined) updates.theme = body.theme.trim()
  if (body.situation !== undefined) updates.situation = body.situation.trim() || null
  if (body.task !== undefined) updates.task = body.task.trim() || null
  if (body.action !== undefined) updates.action = body.action.trim() || null
  if (body.result !== undefined) updates.result = body.result.trim() || null
  if (body.reflection !== undefined) updates.reflection = body.reflection.trim() || null
  if (body.tags !== undefined) updates.tags = body.tags

  const { data, error } = await supabase
    .from('story_bank')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) return Response.json({ error: 'Update failed' }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase
    .from('story_bank')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
