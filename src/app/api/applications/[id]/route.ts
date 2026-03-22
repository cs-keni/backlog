import { createClient } from '@/lib/supabase/server'

// GET /api/applications/[id] — returns application + timeline for detail panel
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [appResult, timelineResult] = await Promise.all([
    supabase
      .from('applications')
      .select(`
        id, status, applied_at, last_updated, notes, recruiter_name, recruiter_email,
        jobs (id, title, company, location, salary_min, salary_max, url, is_remote, tags)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('application_timeline')
      .select('id, application_id, from_status, to_status, changed_at, note')
      .eq('application_id', id)
      .order('changed_at', { ascending: true }),
  ])

  if (appResult.error || !appResult.data) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json({
    application: appResult.data,
    timeline: timelineResult.data ?? [],
  })
}

// PATCH /api/applications/[id] — update status, notes, recruiter; writes timeline on status change
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Fetch current status before updating (needed for timeline)
  const { data: current, error: fetchError } = await supabase
    .from('applications')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !current) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const validStatuses = ['saved', 'applied', 'phone_screen', 'technical', 'final', 'offer', 'rejected']
  if (body.status !== undefined && !validStatuses.includes(body.status as string)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { last_updated: new Date().toISOString() }
  if (body.status !== undefined) updates.status = body.status
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.recruiter_name !== undefined) updates.recruiter_name = body.recruiter_name
  if (body.recruiter_email !== undefined) updates.recruiter_email = body.recruiter_email
  // Stamp applied_at the first time status reaches 'applied'
  if (body.status === 'applied') updates.applied_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('applications')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, status, applied_at, last_updated, notes, recruiter_name, recruiter_email')
    .single()

  if (error) {
    console.error('[PATCH /api/applications/[id]]', error)
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }

  // Write timeline row whenever status changes
  if (body.status && body.status !== current.status) {
    await supabase.from('application_timeline').insert({
      application_id: id,
      from_status: current.status,
      to_status: body.status,
      changed_at: new Date().toISOString(),
    })
  }

  return Response.json(data)
}
