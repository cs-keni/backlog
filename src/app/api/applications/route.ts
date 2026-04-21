import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, status, applied_at, last_updated, notes, recruiter_name, recruiter_email,
      jobs (
        id, title, company, location, salary_min, salary_max, url, is_remote, tags
      )
    `)
    .eq('user_id', user.id)
    .order('last_updated', { ascending: false })

  if (error) {
    console.error('[GET /api/applications]', error)
    return Response.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }

  return Response.json(data)
}

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

  // Check if this application already exists (to avoid duplicate timeline rows on re-POST)
  const { data: existing } = await supabase
    .from('applications')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('job_id', body.job_id)
    .maybeSingle()

  const isNew = !existing

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

  // Only write the initial timeline row for genuinely new applications
  if (isNew) {
    await supabase.from('application_timeline').insert({
      application_id: data.id,
      from_status: null,
      to_status: body.status,
      changed_at: new Date().toISOString(),
    })
  }

  return Response.json(data, { status: 201 })
}
