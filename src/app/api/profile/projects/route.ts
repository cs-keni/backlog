import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('display_order')

  if (error) {
    console.error('[GET /api/profile/projects]', error)
    return Response.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }

  return Response.json(data)
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

  if (typeof body.name !== 'string' || !body.name.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: body.name,
      description: typeof body.description === 'string' ? body.description || null : null,
      role: typeof body.role === 'string' ? body.role || null : null,
      tech_stack: Array.isArray(body.tech_stack) ? body.tech_stack : [],
      url: typeof body.url === 'string' ? body.url || null : null,
      highlights: Array.isArray(body.highlights) ? body.highlights : [],
      start_date: typeof body.start_date === 'string' ? body.start_date || null : null,
      end_date: typeof body.end_date === 'string' ? body.end_date || null : null,
      is_current: body.is_current === true,
      display_order: typeof body.display_order === 'number' ? body.display_order : 0,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[POST /api/profile/projects]', error)
    return Response.json({ error: 'Failed to create project' }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
