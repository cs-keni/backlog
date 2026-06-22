export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { markdown: string }
  try {
    body = await request.json() as { markdown: string }
    if (!body.markdown || typeof body.markdown !== 'string') throw new Error()
  } catch {
    return Response.json({ error: 'Expected { markdown: string }' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from('users')
    .update({ resume_markdown: body.markdown })
    .eq('id', auth.userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, chars: body.markdown.length })
}
