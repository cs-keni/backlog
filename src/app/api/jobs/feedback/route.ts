import { createClient } from '@/lib/supabase/server'
import { isDismissReason } from '@/lib/feed/feedback-filters'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { job_id?: unknown; reason?: unknown } | null
  if (!body || typeof body.job_id !== 'string' || !isDismissReason(body.reason)) {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { error } = await supabase
    .from('job_feedback')
    .upsert(
      { user_id: user.id, job_id: body.job_id, reason: body.reason },
      { onConflict: 'user_id,job_id' }
    )

  if (error) {
    console.error('[POST /api/jobs/feedback]', error)
    return Response.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
