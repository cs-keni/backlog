import { createClient } from '@/lib/supabase/server'

// DELETE — revoke a key by setting revoked_at
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id) // ensure ownership
    .is('revoked_at', null)

  if (error) return Response.json({ error: 'Failed to revoke' }, { status: 500 })
  return Response.json({ ok: true })
}
