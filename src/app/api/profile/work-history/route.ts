import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('work_history')
    .select('*')
    .eq('user_id', user.id)
    .order('display_order', { ascending: true })

  if (error) return Response.json({ error: 'Failed to fetch work history' }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.company || !body.title) {
    return Response.json({ error: 'company and title are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('work_history')
    .insert({
      user_id: user.id,
      company: body.company,
      title: body.title,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      is_current: body.is_current ?? false,
      description: body.description ?? null,
      display_order: body.display_order ?? 0,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[POST /api/profile/work-history]', error)
    return Response.json({ error: 'Failed to create entry' }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
