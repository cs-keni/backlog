import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('lc_reviews')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, completed_at')
    .single()

  if (error) {
    console.error('[PATCH /api/dsa/reviews/[id]]', error)
    return Response.json({ error: 'Failed to complete review' }, { status: 500 })
  }

  return Response.json(data)
}
