import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('saved_answers')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: 'Failed to fetch saved answers' }, { status: 500 })
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

  if (!body.question || !body.answer) {
    return Response.json({ error: 'question and answer are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('saved_answers')
    .insert({ user_id: user.id, question: body.question, answer: body.answer })
    .select('*')
    .single()

  if (error) {
    console.error('[POST /api/profile/saved-answers]', error)
    return Response.json({ error: 'Failed to create answer' }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
