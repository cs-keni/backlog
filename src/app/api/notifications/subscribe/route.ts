import { createClient } from '@/lib/supabase/server'

// POST — save a push subscription for the current user
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { endpoint: string; keys: { p256dh: string; auth: string } }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { endpoint, keys } = body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: 'Missing subscription fields' }, { status: 400 })
  }

  // Upsert by endpoint — browser may re-subscribe with same endpoint
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' }
    )

  if (error) {
    console.error('[POST /api/notifications/subscribe]', error)
    return Response.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  // Enable push notifications on user profile
  await supabase.from('users').update({ notification_push: true }).eq('id', user.id)

  return Response.json({ ok: true })
}

// DELETE — remove a push subscription (disable push for this browser)
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { endpoint: string }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', body.endpoint)

  // If user has no more subscriptions, disable push flag
  const { count } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count === 0) {
    await supabase.from('users').update({ notification_push: false }).eq('id', user.id)
  }

  return Response.json({ ok: true })
}
