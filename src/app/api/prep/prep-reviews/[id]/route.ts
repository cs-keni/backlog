import { createClient } from '@/lib/supabase/server'
import { addDays, computeNextInterval, getTodayLocal } from '@/lib/dsa/schedule'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { difficulty?: unknown }
  try {
    body = await request.json() as { difficulty?: unknown }
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.difficulty !== 'easy' && body.difficulty !== 'hard') {
    return Response.json({ error: 'Invalid difficulty' }, { status: 400 })
  }

  const { id } = await params
  const { data: current, error: fetchError } = await supabase
    .from('prep_reviews')
    .select('id, user_id, interval_days')
    .eq('id', id)
    .single()

  if (fetchError || !current || current.user_id !== user.id) {
    return Response.json({ error: 'Review not found' }, { status: 403 })
  }

  const nextInterval = computeNextInterval(current.interval_days ?? 1, body.difficulty)
  const nextReviewAt = addDays(getTodayLocal(), nextInterval)

  const { data, error } = await supabase
    .from('prep_reviews')
    .update({
      interval_days: nextInterval,
      next_review_at: nextReviewAt,
      last_difficulty: body.difficulty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, question_id, bank, interval_days, next_review_at, last_difficulty')
    .single()

  if (error) {
    console.error('[PATCH /api/prep/prep-reviews/[id]]', error)
    return Response.json({ error: 'Failed to update prep review' }, { status: 500 })
  }

  return Response.json(data)
}
