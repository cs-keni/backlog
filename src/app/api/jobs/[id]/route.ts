import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, title, company, company_id,
      company_profiles (
        id, name, description, mission, notable_products, website_url,
        headcount_range, funding_stage, tech_stack, enriched_at
      ),
      applications!left ( id, status )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return Response.json({ error: 'Job not found' }, { status: 404 })

  return Response.json(data)
}
