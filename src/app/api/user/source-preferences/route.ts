import { createClient } from '@/lib/supabase/server'
import { isSourcePreferenceAction, updateSourcePreferences, type SourcePreferences } from '@/lib/user/source-preferences'

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { source?: unknown; action?: unknown }
  try {
    body = await request.json() as { source?: unknown; action?: unknown }
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.source !== 'string' || body.source.length === 0 || !isSourcePreferenceAction(body.action)) {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { data: current, error: fetchError } = await supabase
    .from('users')
    .select('source_preferences')
    .eq('id', user.id)
    .single()

  if (fetchError) {
    console.error('[PUT /api/user/source-preferences] fetch error', fetchError)
    return Response.json({ error: 'Failed to load preferences' }, { status: 500 })
  }

  const source_preferences = updateSourcePreferences(
    current?.source_preferences as SourcePreferences | null,
    body.source,
    body.action,
  )

  const { error: updateError } = await supabase
    .from('users')
    .update({ source_preferences })
    .eq('id', user.id)

  if (updateError) {
    console.error('[PUT /api/user/source-preferences] update error', updateError)
    return Response.json({ error: 'Failed to update preferences' }, { status: 500 })
  }

  return Response.json({ ok: true, source_preferences })
}
