import { createClient } from '@/lib/supabase/server'
import { generateApiKey, hashApiKey } from '@/lib/auth/api-key'

export const dynamic = 'force-dynamic'

// GET — list this user's API keys (never returns raw key)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('api_keys')
    .select('id, label, last_used_at, created_at, revoked_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  return Response.json({ keys: data ?? [] })
}

// POST — generate a new API key; returns the raw key ONCE
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let label = 'Backlog Extension'
  try {
    const body = await request.json() as { label?: string }
    if (typeof body.label === 'string' && body.label.trim()) {
      label = body.label.trim().slice(0, 64)
    }
  } catch { /* label stays default */ }

  const rawKey = generateApiKey()
  const keyHash = hashApiKey(rawKey)

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: user.id, key_hash: keyHash, label })
    .select('id, label, created_at')
    .single()

  if (error) {
    console.error('[POST /api/keys]', error)
    return Response.json({ error: 'Failed to create key' }, { status: 500 })
  }

  // Raw key returned ONCE — not stored, cannot be recovered
  return Response.json({ key: rawKey, id: data.id, label: data.label }, { status: 201 })
}
