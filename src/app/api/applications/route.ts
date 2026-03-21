import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { job_id?: unknown; status?: unknown }
  try {
    body = await request.json() as { job_id?: unknown; status?: unknown }
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.job_id !== 'string' || typeof body.status !== 'string') {
    return Response.json({ error: 'job_id and status are required' }, { status: 400 })
  }

  const validStatuses = ['saved', 'applied', 'phone_screen', 'technical', 'final', 'offer', 'rejected']
  if (!validStatuses.includes(body.status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Upsert — one application row per user+job
  const { data, error } = await supabase
    .from('applications')
    .upsert(
      {
        user_id: user.id,
        job_id: body.job_id,
        status: body.status,
        applied_at: body.status === 'applied' ? new Date().toISOString() : null,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'user_id,job_id' }
    )
    .select('id, status')
    .single()

  if (error) {
    console.error('[POST /api/applications]', error)
    return Response.json({ error: 'Failed to save application' }, { status: 500 })
  }

  // Write timeline row
  await supabase.from('application_timeline').insert({
    application_id: data.id,
    from_status: null,
    to_status: body.status,
    changed_at: new Date().toISOString(),
  })

  return Response.json(data, { status: 201 })
}
