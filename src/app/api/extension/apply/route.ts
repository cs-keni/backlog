import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface ApplyBody {
  jobUrl: string
  jobTitle?: string
  company?: string
  jobId?: string
  applicationId?: string
}

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: ApplyBody
  try {
    body = await request.json() as ApplyBody
    if (!body.jobUrl) throw new Error('missing jobUrl')
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find or create job
  let jobId: string

  if (body.applicationId) {
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id, status')
      .eq('id', body.applicationId)
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (existingApp) {
      if (existingApp.status === 'saved') {
        await supabase
          .from('applications')
          .update({ status: 'applied', applied_at: new Date().toISOString(), last_updated: new Date().toISOString() })
          .eq('id', existingApp.id)

        await supabase.from('application_timeline').insert({
          application_id: existingApp.id,
          from_status: 'saved',
          to_status: 'applied',
          note: 'Applied via Backlog extension',
        })
      }
      return Response.json({ applicationId: existingApp.id, created: false })
    }
  }

  if (body.jobId) {
    const { data: existingJobById } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', body.jobId)
      .maybeSingle()
    if (!existingJobById) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }
    jobId = existingJobById.id as string
  } else {
    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('url', body.jobUrl)
      .maybeSingle()

    if (existingJob) {
      jobId = existingJob.id as string
    } else {
      // Create a minimal job stub from URL info
      const { data: newJob, error } = await supabase
        .from('jobs')
        .insert({
          url: body.jobUrl,
          title: body.jobTitle ?? 'Unknown role',
          company: body.company ?? 'Unknown company',
          source: 'manual',
          source_detail: 'extension',
          hide_from_feed: true,
          posted_at: new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error || !newJob) {
        return Response.json({ error: 'Failed to create job' }, { status: 500 })
      }
      jobId = newJob.id as string
    }
  }

  // Upsert application (idempotent — clicking Apply twice is fine)
  const { data: existing } = await supabase
    .from('applications')
    .select('id, status')
    .eq('user_id', auth.userId)
    .eq('job_id', jobId)
    .maybeSingle()

  if (existing) {
    // Already tracked — update status to applied if still saved
    if (existing.status === 'saved') {
      await supabase
        .from('applications')
        .update({ status: 'applied', applied_at: new Date().toISOString(), last_updated: new Date().toISOString() })
        .eq('id', existing.id)

      await supabase.from('application_timeline').insert({
        application_id: existing.id,
        from_status: 'saved',
        to_status: 'applied',
        note: 'Applied via Backlog extension',
      })
    }
    return Response.json({ applicationId: existing.id, created: false })
  }

  // New application
  const { data: app, error: appError } = await supabase
    .from('applications')
    .insert({
      user_id: auth.userId,
      job_id: jobId,
      status: 'applied',
      applied_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (appError || !app) {
    return Response.json({ error: 'Failed to create application' }, { status: 500 })
  }

  await supabase.from('application_timeline').insert({
    application_id: app.id,
    from_status: null,
    to_status: 'applied',
    note: 'Applied via Backlog extension',
  })

  return Response.json({ applicationId: app.id, created: true }, { status: 201 })
}
