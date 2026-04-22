import { createClient } from '@/lib/supabase/server'
import { extractJobFromUrl } from '@/lib/jobs/url-extractor'

export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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

  const result = await extractJobFromUrl(url)

  if (!result.ok) {
    return Response.json(
      { error: result.error, jsRendered: result.jsRendered },
      { status: result.jsRendered ? 422 : 502 }
    )
  }

  return Response.json({ job: result.job })
}
