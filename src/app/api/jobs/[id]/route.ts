import { createClient } from '@/lib/supabase/server'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let supabase = await createClient()
  let userId: string | null = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    userId = user.id
  } else {
    const apiAuth = await verifyApiKeyFromRequest(request)
    if (!apiAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    userId = apiAuth.userId
    supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as unknown as Awaited<ReturnType<typeof createClient>>
  }

  const { id } = await params

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, title, company, company_id, url,
      company_profiles (
        id, name, description, mission, notable_products, website_url,
        headcount_range, funding_stage, tech_stack, enriched_at
      ),
      applications!left ( id, status )
    `)
    .eq('id', id)
    .eq('applications.user_id', userId)
    .single()

  if (error || !data) return Response.json({ error: 'Job not found' }, { status: 404 })

  return Response.json(data)
}
