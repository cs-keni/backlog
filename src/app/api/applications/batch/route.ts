import { createClient } from '@/lib/supabase/server'
import type { ApplicationStatus } from '@/lib/jobs/types'
import { hasE2EAuthCookie } from '@/lib/e2e/server'

const VALID_STATUSES: ApplicationStatus[] = [
  'saved', 'applied', 'phone_screen', 'technical', 'final', 'offer', 'rejected',
]

export async function POST(request: Request) {
  if (hasE2EAuthCookie(request)) {
    const body = await request.json().catch(() => null) as { ids?: unknown } | null
    const count = Array.isArray(body?.ids) ? body.ids.length : 0
    return Response.json({ updated: count })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { ids?: unknown; action?: unknown; status?: unknown }
  try {
    body = await request.json() as { ids?: unknown; action?: unknown; status?: unknown }
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return Response.json({ error: 'ids must be a non-empty array' }, { status: 422 })
  }

  const ids = body.ids as string[]
  const action = body.action

  if (action !== 'archive' && action !== 'status') {
    return Response.json({ error: 'action must be "archive" or "status"' }, { status: 422 })
  }

  if (action === 'status' && !VALID_STATUSES.includes(body.status as ApplicationStatus)) {
    return Response.json({ error: 'Invalid status' }, { status: 422 })
  }

  // Ownership check: every ID must belong to this user
  const { data: owned, error: fetchError } = await supabase
    .from('applications')
    .select('id')
    .in('id', ids)
    .eq('user_id', user.id)

  if (fetchError) {
    console.error('[POST /api/applications/batch]', fetchError)
    return Response.json({ error: 'Failed to verify ownership' }, { status: 500 })
  }

  if ((owned?.length ?? 0) < ids.length) {
    return Response.json({ error: 'Some applications do not belong to this user' }, { status: 403 })
  }

  const updates: Record<string, unknown> = { last_updated: new Date().toISOString() }
  if (action === 'archive') {
    updates.is_archived = true
  } else {
    updates.status = body.status
  }

  const { error: updateError } = await supabase
    .from('applications')
    .update(updates)
    .in('id', ids)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[POST /api/applications/batch]', updateError)
    return Response.json({ error: 'Batch update failed' }, { status: 500 })
  }

  return Response.json({ updated: ids.length })
}
