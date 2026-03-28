export const maxDuration = 30

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enrichCompany } from '@/lib/llm/company-enricher'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Return cached enrichment if it already exists
  const { data: company } = await supabase
    .from('company_profiles')
    .select('id, name, description, headcount_range, funding_stage, tech_stack, enriched_at')
    .eq('id', id)
    .single()

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 })

  if (company.enriched_at) {
    return Response.json(company)
  }

  // Fetch up to 5 job descriptions for this company
  const { data: jobs } = await supabase
    .from('jobs')
    .select('title, description')
    .eq('company_id', id)
    .not('description', 'is', null)
    .order('fetched_at', { ascending: false })
    .limit(5)

  const result = await enrichCompany(company.name, jobs ?? [])

  const admin = createAdminClient()
  const { data: updated } = await admin
    .from('company_profiles')
    .update({
      description: result.description || company.description,
      headcount_range: result.headcount_range || company.headcount_range,
      funding_stage: result.funding_stage || company.funding_stage,
      tech_stack: result.tech_stack,
      enriched_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, name, description, headcount_range, funding_stage, tech_stack, enriched_at')
    .single()

  return Response.json(updated ?? company)
}
