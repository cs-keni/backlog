export const dynamic = 'force-dynamic'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'

export async function POST(request: Request) {
  // API key auth (extension/script) or session auth (web UI)
  let userId: string
  const apiAuth = await verifyApiKeyFromRequest(request)
  if (apiAuth) {
    userId = apiAuth.userId
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
  }

  let body: { markdown: string }
  try {
    body = await request.json() as { markdown: string }
    if (!body.markdown || typeof body.markdown !== 'string') throw new Error()
  } catch {
    return Response.json({ error: 'Expected { markdown: string }' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await serviceSupabase
    .from('users')
    .update({ resume_markdown: body.markdown })
    .eq('id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, chars: body.markdown.length })
}
