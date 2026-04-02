import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface AddJobBody {
  url: string
  title: string
  company: string
  description?: string
  location?: string
}

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: AddJobBody
  try {
    body = await request.json() as AddJobBody
    if (!body.url || !body.title || !body.company) throw new Error('missing required fields')
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Deduplicate
  const { data: existing } = await supabase
    .from('jobs')
    .select('id')
    .eq('url', body.url)
    .maybeSingle()

  if (existing) {
    return Response.json({ job: existing, duplicate: true })
  }

  // Upsert company stub
  let companyId: string | null = null
  const { data: company } = await supabase
    .from('company_profiles')
    .upsert({ name: body.company }, { onConflict: 'name', ignoreDuplicates: false })
    .select('id')
    .single()
  companyId = company?.id ?? null

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      url: body.url,
      title: body.title,
      company: body.company,
      company_id: companyId,
      description: body.description ?? null,
      location: body.location ?? null,
      source: 'manual',
      posted_at: new Date().toISOString(),
      fetched_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !job) {
    return Response.json({ error: 'Failed to save job' }, { status: 500 })
  }

  return Response.json({ job, duplicate: false }, { status: 201 })
}
