import { createClient } from '@/lib/supabase/server'

// GET — return current user's notification preferences
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select(`
      notification_email,
      notification_push,
      notification_quiet_hours_start,
      notification_quiet_hours_end,
      alert_match_threshold
    `)
    .eq('id', user.id)
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

// PATCH — update notification preferences
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const allowed = [
    'notification_email',
    'notification_push',
    'notification_quiet_hours_start',
    'notification_quiet_hours_end',
    'alert_match_threshold',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select('notification_email, notification_push, notification_quiet_hours_start, notification_quiet_hours_end, alert_match_threshold')
    .single()

  if (error) {
    console.error('[PATCH /api/settings]', error)
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }

  return Response.json(data)
}
