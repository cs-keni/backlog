import { createClient } from '@/lib/supabase/server'
import { getTodayLocal } from '@/lib/dsa/schedule'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const today = getTodayLocal()

  const { error } = await supabase
    .from('lc_reviews')
    .update({ scheduled_for: today })
    .eq('user_id', user.id)
    .is('completed_at', null)
    .lt('scheduled_for', today)

  if (error) {
    console.error('[POST /api/dsa/reviews/reschedule]', error)
    return Response.json({ error: 'Failed to reschedule reviews' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
