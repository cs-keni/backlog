import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('education')
    .select('*')
    .eq('user_id', user.id)
    .order('display_order', { ascending: true })

  if (error) return Response.json({ error: 'Failed to fetch education' }, { status: 500 })
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

  if (!body.school) {
    return Response.json({ error: 'school is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('education')
    .insert({
      user_id: user.id,
      school: body.school,
      degree: body.degree ?? null,
      field_of_study: body.field_of_study ?? null,
      gpa: body.gpa ?? null,
      graduation_year: body.graduation_year ?? null,
      display_order: body.display_order ?? 0,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[POST /api/profile/education]', error)
    return Response.json({ error: 'Failed to create entry' }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
