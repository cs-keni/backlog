import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { ApplicationStatus } from '@/lib/jobs/types'

type SupabaseError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

type ManualJob = {
  id: string
  title: string
  company: string
  location: string | null
  salary_min: number | null
  salary_max: number | null
  url: string | null
  is_remote: boolean
  tags: string[] | null
}

const VALID_STATUSES: ApplicationStatus[] = [
  'saved', 'applied', 'phone_screen', 'technical', 'final', 'offer', 'rejected',
]

function logSupabaseError(context: string, error: SupabaseError | null) {
  console.error(context, JSON.stringify(error ?? null))
}

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
  const { data: companyRow, error: companyError } = await serviceClient
    .from('company_profiles')
    .upsert({ name: company }, { onConflict: 'name', ignoreDuplicates: false })
    .select('id')
    .single()

  if (companyError) {
    logSupabaseError('[manual] company upsert failed:', companyError)
  }

  let companyId = companyRow?.id ?? null
  if (!companyId) {
    const { data: existingCompany, error: existingCompanyError } = await serviceClient
      .from('company_profiles')
      .select('id')
      .eq('name', company)
      .maybeSingle()

    if (existingCompanyError) {
      logSupabaseError('[manual] company fallback select failed:', existingCompanyError)
    }
    companyId = existingCompany?.id ?? null
  }

  // Insert job
  const jobUrl = typeof body.url === 'string' ? body.url.trim() || null : null
  const jobInsert = {
    title,
    company,
    company_id: companyId ?? null,
    location: typeof body.location === 'string' ? body.location.trim() || null : null,
    url: jobUrl,
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
  }

  let createdJob = true
  let { data: job, error: jobError } = await serviceClient
    .from('jobs')
    .insert(jobInsert)
    .select('id, title, company, location, salary_min, salary_max, url, is_remote, tags')
    .single()

  if (jobError?.code === '23505' && jobUrl) {
    logSupabaseError('[manual] duplicate job insert, reusing existing job:', jobError)
    const fallback = await serviceClient
      .from('jobs')
      .select('id, title, company, location, salary_min, salary_max, url, is_remote, tags')
      .eq('url', jobUrl)
      .maybeSingle()

    job = fallback.data as ManualJob | null
    jobError = fallback.error
    createdJob = false
  }

  if (jobError || !job) {
    logSupabaseError('[manual] job insert failed:', jobError)
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

  const { data: existingApplication } = await supabase
    .from('applications')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('job_id', job.id)
    .maybeSingle()

  // Create application using user auth (so RLS applies correctly)
  const { data: application, error: appError } = await supabase
    .from('applications')
    .upsert({
      user_id: user.id,
      job_id: job.id,
      status,
      applied_at: appliedAt,
      last_updated: now,
      notes: notesValue,
    }, { onConflict: 'user_id,job_id' })
    .select('id, user_id, job_id, status, is_archived, applied_at, last_updated, notes, recruiter_name, recruiter_email')
    .single()

  if (appError || !application) {
    logSupabaseError('[manual] application upsert failed:', appError)
    if (createdJob) {
      // Clean up orphaned job
      await serviceClient.from('jobs').delete().eq('id', job.id)
    }
    return Response.json({ error: 'Failed to create application' }, { status: 500 })
  }

  if (!existingApplication || existingApplication.status !== status) {
    await supabase.from('application_timeline').insert({
      application_id: application.id,
      from_status: existingApplication?.status ?? null,
      to_status: status,
      changed_at: now,
    })
  }

  return Response.json(
    {
      job_id: job.id,
      application_id: application.id,
      application: { ...application, jobs: job },
    },
    { status: 201 }
  )
}
