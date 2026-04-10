import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('story_bank')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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

  if (!body.title?.trim()) return Response.json({ error: 'title is required' }, { status: 400 })
  if (!body.theme?.trim()) return Response.json({ error: 'theme is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('story_bank')
    .insert({
      user_id: user.id,
      title: body.title.trim(),
      theme: body.theme.trim(),
      situation: body.situation?.trim() ?? null,
      task: body.task?.trim() ?? null,
      action: body.action?.trim() ?? null,
      result: body.result?.trim() ?? null,
      reflection: body.reflection?.trim() ?? null,
      tags: body.tags ?? [],
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
