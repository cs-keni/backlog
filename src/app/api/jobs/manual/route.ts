import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { ApplicationStatus } from '@/lib/jobs/types'

const VALID_STATUSES: ApplicationStatus[] = [
  'saved', 'applied', 'phone_screen', 'technical', 'final', 'offer', 'rejected',
]

export async function POST(request: Request) {
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

  const company = typeof body.company === 'string' ? body.company.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!company) return Response.json({ error: 'company is required' }, { status: 400 })
  if (!title) return Response.json({ error: 'title is required' }, { status: 400 })

  const status: ApplicationStatus = VALID_STATUSES.includes(body.status as ApplicationStatus)
    ? (body.status as ApplicationStatus)
    : 'applied'

  const appliedAt =
    typeof body.applied_date === 'string' && body.applied_date
      ? new Date(body.applied_date).toISOString()
      : new Date().toISOString()

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Upsert company stub
  const { data: companyRow } = await serviceClient
    .from('company_profiles')
    .upsert({ name: company }, { onConflict: 'name', ignoreDuplicates: false })
    .select('id')
    .single()
  const companyId = companyRow?.id ?? null

  // Insert job
  const { data: job, error: jobError } = await serviceClient
    .from('jobs')
    .insert({
      title,
      company,
      company_id: companyId,
      location: typeof body.location === 'string' ? body.location.trim() || null : null,
      url: typeof body.url === 'string' ? body.url.trim() || null : null,
      description: typeof body.description === 'string' ? body.description || null : null,
      tags: Array.isArray(body.tags) ? body.tags : null,
      salary_min: typeof body.salary_min === 'number' ? body.salary_min : null,
      salary_max: typeof body.salary_max === 'number' ? body.salary_max : null,
      is_remote: body.is_remote === true,
      experience_level: typeof body.experience_level === 'string' ? body.experience_level || null : null,
      source: 'manual',
      hide_from_feed: true,
      posted_at: new Date().toISOString(),
      fetched_at: new Date().toISOString(),
    })
    .select('id, title, company, location, salary_min, salary_max, url, is_remote, tags')
    .single()

  if (jobError || !job) {
    console.error('[manual] job insert failed:', jobError)
    return Response.json({ error: 'Failed to create job' }, { status: 500 })
  }

  const now = new Date().toISOString()
  const notesValue =
    typeof body.notes === 'string' && body.notes.trim()
      ? {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: body.notes.trim() }] }],
        }
      : null

  // Create application using user auth (so RLS applies correctly)
  const { data: application, error: appError } = await supabase
    .from('applications')
    .insert({
      user_id: user.id,
      job_id: job.id,
      status,
      applied_at: appliedAt,
      last_updated: now,
      notes: notesValue,
    })
    .select('id, user_id, job_id, status, is_archived, applied_at, last_updated, notes, recruiter_name, recruiter_email')
    .single()

  if (appError || !application) {
    console.error('[manual] application insert failed:', appError)
    // Clean up orphaned job
    await serviceClient.from('jobs').delete().eq('id', job.id)
    return Response.json({ error: 'Failed to create application' }, { status: 500 })
  }

  // Initial timeline entry
  await supabase.from('application_timeline').insert({
    application_id: application.id,
    from_status: null,
    to_status: status,
    changed_at: now,
  })

  return Response.json(
    {
      job_id: job.id,
      application_id: application.id,
      application: { ...application, jobs: job },
    },
    { status: 201 }
  )
}
