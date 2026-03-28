export const maxDuration = 45

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enrichCompany } from '@/lib/llm/company-enricher'

const FULL_SELECT = 'id, name, description, mission, notable_products, website_url, headcount_range, funding_stage, tech_stack, enriched_at'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: company } = await supabase
    .from('company_profiles')
    .select(FULL_SELECT)
    .eq('id', id)
    .single()

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 })

  if (company.enriched_at) {
    return Response.json(company)
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
