import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { application_id?: unknown; content?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.application_id !== 'string' || typeof body.content !== 'string' || body.content.trim().length === 0) {
    return Response.json({ error: 'application_id and content are required' }, { status: 400 })
  }

  const { data: app } = await supabase
    .from('applications')
    .select('id')
    .eq('id', body.application_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!app) return Response.json({ error: 'Application not found' }, { status: 404 })

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('interview_kits')
    .upsert(
      {
        application_id: body.application_id,
        content: body.content,
        generated_at: now,
      },
      { onConflict: 'application_id' }
    )
    .select('id, application_id, generated_at, content, created_at')
    .single()

  if (error || !data) {
    console.error('[POST /api/prep/interview-kit/save]', error)
    return Response.json({ error: 'Failed to save interview kit' }, { status: 500 })
  }

  return Response.json(data)
}
