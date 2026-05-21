import { createClient } from '@/lib/supabase/server'
import { hasE2EAuthCookie } from '@/lib/e2e/server'
import { e2eApplicationById, e2eTimeline } from '@/lib/e2e/fixtures'
import { computeAtsCompleteness } from '@/lib/tracker/ats-fields'

// GET /api/applications/[id] — returns application + timeline for detail panel
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (hasE2EAuthCookie(request)) {
    const application = e2eApplicationById(id)
    if (!application) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({
      application,
      timeline: e2eTimeline.filter((entry) => entry.application_id === id),
    })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [appResult, timelineResult, profileResult, coverLetterResult, interviewKitResult] = await Promise.all([
    supabase
      .from('applications')
      .select(`
        id, status, applied_at, last_updated, notes, recruiter_name, recruiter_email, ats_platform,
        jobs (id, title, company, location, salary_min, salary_max, url, is_remote, tags, fetched_at)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('application_timeline')
      .select('id, application_id, from_status, to_status, changed_at, note')
      .eq('application_id', id)
      .order('changed_at', { ascending: true }),
    supabase
      .from('users')
      .select('full_name, email, resume_text, linkedin_url, street_address, phone, work_authorization')
      .eq('id', user.id)
      .single(),
    supabase
      .from('cover_letters')
      .select('id')
      .eq('user_id', user.id)
      .eq('application_id', id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('interview_kits')
      .select('id')
      .eq('user_id', user.id)
      .eq('application_id', id)
      .limit(1)
      .maybeSingle(),
  ])

  if (appResult.error || !appResult.data) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  type AppWithJob = {
    ats_platform?: string | null
    jobs?: { company?: string | null } | null
  }
  const appData = appResult.data as AppWithJob
  const company = appData.jobs?.company
  let priorApplications: unknown[] = []
  if (company) {
    const { data: priorApps } = await supabase
      .from('applications')
      .select('id, status, applied_at, jobs!inner(title, company)')
      .eq('user_id', user.id)
      .neq('id', id)
      .eq('jobs.company', company)
      .order('applied_at', { ascending: false })
      .limit(3)
    priorApplications = priorApps ?? []
  }

  return Response.json({
    application: appResult.data,
    timeline: timelineResult.data ?? [],
    detail: {
      hasResume: Boolean(profileResult.data?.resume_text?.trim()),
      hasCoverLetter: Boolean(coverLetterResult.data),
      hasInterviewKit: Boolean(interviewKitResult.data),
      priorApplications,
      atsCompleteness: computeAtsCompleteness(appData.ats_platform, {
        full_name: profileResult.data?.full_name ?? null,
        email: profileResult.data?.email ?? user.email ?? null,
        resume_text: profileResult.data?.resume_text ?? null,
        linkedin_url: profileResult.data?.linkedin_url ?? null,
        street_address: profileResult.data?.street_address ?? null,
        phone: profileResult.data?.phone ?? null,
        work_authorization: profileResult.data?.work_authorization ?? null,
      }),
    },
  })
}

// PATCH /api/applications/[id] — update status, notes, recruiter; writes timeline on status change
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (hasE2EAuthCookie(request)) {
    const current = e2eApplicationById(id)
    if (!current) return Response.json({ error: 'Not found' }, { status: 404 })
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    return Response.json({
      id,
      status: typeof body.status === 'string' ? body.status : current.status,
      applied_at: current.applied_at,
      last_updated: new Date().toISOString(),
      notes: body.notes ?? current.notes,
      recruiter_name: body.recruiter_name ?? current.recruiter_name,
      recruiter_email: body.recruiter_email ?? current.recruiter_email,
    })
  }

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
  if (body.is_archived !== undefined) updates.is_archived = Boolean(body.is_archived)
  // Stamp applied_at only on the first transition to 'applied' — never overwrite
  if (body.status === 'applied' && current.status !== 'applied') {
    updates.applied_at = new Date().toISOString()
  }

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

// DELETE /api/applications/[id] — remove application entirely
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (hasE2EAuthCookie(request)) {
    return new Response(null, { status: 204 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[DELETE /api/applications/[id]]', error)
    return Response.json({ error: 'Delete failed' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
