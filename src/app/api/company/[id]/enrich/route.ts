export const maxDuration = 45

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { e2eCompany } from '@/lib/e2e/fixtures'
import { hasE2EAuthCookie } from '@/lib/e2e/server'
import { enrichCompany } from '@/lib/llm/company-enricher'

const FULL_SELECT = 'id, name, description, mission, notable_products, website_url, headcount_range, funding_stage, tech_stack, enriched_at'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let force = false
  try {
    const body = await request.json() as { force?: unknown }
    force = body.force === true
  } catch {
    force = false
  }

  if (hasE2EAuthCookie(request)) {
    if (id !== e2eCompany.id) {
      return Response.json({ error: 'Company not found' }, { status: 404 })
    }
    if (force) {
      return Response.json(
        { error: 'Company data was refreshed recently - try again tomorrow' },
        { status: 429 }
      )
    }
    return Response.json(e2eCompany)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabase
    .from('company_profiles')
    .select(FULL_SELECT)
    .eq('id', id)
    .single()

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 })

  if (company.enriched_at && !force) {
    return Response.json(company)
  }
  if (company.enriched_at && force) {
    const enrichedAt = new Date(company.enriched_at).getTime()
    const cooldownMs = 24 * 60 * 60 * 1000
    if (Date.now() - enrichedAt < cooldownMs) {
      return Response.json(
        { error: 'Company data was refreshed recently - try again tomorrow' },
        { status: 429 }
      )
    }
  }

  // Fetch up to 5 recent jobs — include URL for website extraction
  const { data: jobs } = await supabase
    .from('jobs')
    .select('title, description, url')
    .eq('company_id', id)
    .order('fetched_at', { ascending: false })
    .limit(5)

  const result = await enrichCompany(company.name, jobs ?? [])

  const admin = createAdminClient()
  const { data: updated } = await admin
    .from('company_profiles')
    .update({
      description: result.description || company.description,
      mission: result.mission || null,
      notable_products: result.notable_products.length ? result.notable_products : null,
      website_url: result.website_url || null,
      headcount_range: result.headcount_range || company.headcount_range,
      funding_stage: result.funding_stage || company.funding_stage,
      tech_stack: result.tech_stack.length ? result.tech_stack : null,
      enriched_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(FULL_SELECT)
    .single()

  return Response.json(updated ?? company)
}
