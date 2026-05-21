import { createClient } from '@/lib/supabase/server'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { hasE2EAuthCookie } from '@/lib/e2e/server'
import { e2eApplications } from '@/lib/e2e/fixtures'

export async function GET(request: Request) {
  if (hasE2EAuthCookie(request)) {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const search = searchParams.get('search')?.toLowerCase()

    if (jobId) {
      const app = e2eApplications.find((application) => application.job_id === jobId)
      return Response.json(app ? { id: app.id, status: app.status, cover_letter_url: null } : null)
    }

    if (search) {
      return Response.json({
        applications: e2eApplications
          .filter((app) => `${app.jobs.title} ${app.jobs.company}`.toLowerCase().includes(search))
          .map((app) => ({
            id: app.id,
            status: app.status,
            title: app.jobs.title,
            company: app.jobs.company,
          })),
      })
    }

    return Response.json(e2eApplications)
  }

  let supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let userId = user?.id ?? null
  if (!userId) {
    const apiAuth = await verifyApiKeyFromRequest(request)
    if (!apiAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    userId = apiAuth.userId
    supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as unknown as Awaited<ReturnType<typeof createClient>>
  }

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  const search = searchParams.get('search')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 200

  if (jobId) {
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id, status')
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .maybeSingle()

    if (appError) {
      console.error('[GET /api/applications?jobId]', appError)
      return Response.json({ error: 'Failed to fetch application' }, { status: 500 })
    }
    if (!app) return Response.json(null)

    const { data: coverLetter } = await supabase
      .from('cover_letters')
      .select('id')
      .eq('user_id', userId)
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return Response.json({
      id: app.id,
      status: app.status,
      cover_letter_url: coverLetter?.id ? `/api/cover-letter/${coverLetter.id}/pdf` : null,
    })
  }

  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, status, applied_at, last_updated, notes, recruiter_name, recruiter_email,
      jobs (
        id, title, company, location, salary_min, salary_max, url, is_remote, tags, fetched_at
      )
    `)
    .eq('user_id', userId)
    .order('last_updated', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[GET /api/applications]', error)
    return Response.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }

  if (search) {
    const q = search.toLowerCase()
    type Row = { id: string; status: string; jobs: { title?: string; company?: string } | null }
    const filtered = ((data ?? []) as Row[])
      .filter(
        (a) =>
          a.jobs?.title?.toLowerCase().includes(q) ||
          a.jobs?.company?.toLowerCase().includes(q)
      )
      .map((a) => ({ id: a.id, status: a.status, title: a.jobs?.title ?? '', company: a.jobs?.company ?? '' }))
    return Response.json({ applications: filtered })
  }

  return Response.json(data)
}

export async function POST(request: Request) {
  if (hasE2EAuthCookie(request)) {
    const body = await request.json().catch(() => null) as { job_id?: string; status?: string } | null
    return Response.json({
      id: body?.job_id === 'e2e-job-1' ? 'e2e-app-1' : 'e2e-app-new',
      status: body?.status ?? 'applied',
    }, { status: 201 })
  }

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
