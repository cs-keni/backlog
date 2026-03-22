import { createClient } from '@/lib/supabase/server'
import { extractJobFromUrl } from '@/lib/jobs/url-extractor'

export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let url: string
  try {
    const body = await request.json() as { url?: unknown }
    if (typeof body.url !== 'string' || !body.url.startsWith('http')) {
      return Response.json({ error: 'Invalid URL' }, { status: 400 })
    }
    url = body.url
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Deduplicate — if we already have this URL, return it
  const { data: existing } = await supabase
    .from('jobs')
    .select('id')
    .eq('url', url)
    .maybeSingle()

  if (existing) {
    return Response.json({ job: existing, duplicate: true })
  }

  const result = await extractJobFromUrl(url)

  if (!result.ok) {
    return Response.json(
      { error: result.error, jsRendered: result.jsRendered },
      { status: result.jsRendered ? 422 : 502 }
    )
  }

  const { job } = result

  // Use service role to write — same as aggregation worker
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Upsert a minimal company_profiles stub
  let companyId: string | null = null
  if (job.company) {
    const { data: companyRow } = await serviceClient
      .from('company_profiles')
      .upsert({ name: job.company }, { onConflict: 'name', ignoreDuplicates: false })
      .select('id')
      .single()
    companyId = companyRow?.id ?? null
  }

  const { data: inserted, error } = await serviceClient
    .from('jobs')
    .insert({
      title: job.title,
      company: job.company,
      company_id: companyId,
      location: job.location,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      url: job.url,
      source: 'manual',
      description: job.description,
      tags: job.tags,
      is_remote: job.is_remote,
      experience_level: job.experience_level,
      posted_at: new Date().toISOString(),
      fetched_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[from-url] insert failed:', error)
    return Response.json({ error: 'Failed to save job' }, { status: 500 })
  }

  return Response.json({ job: inserted, duplicate: false }, { status: 201 })
}
