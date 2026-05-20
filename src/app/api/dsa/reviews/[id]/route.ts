import { createClient } from '@/lib/supabase/server'
import { computeNextInterval, dateDiffDays, addDays, getTodayLocal } from '@/lib/dsa/schedule'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Parse optional difficulty from body
  let difficulty: 'easy' | 'hard' | undefined
  try {
    const body = await request.json() as { difficulty?: unknown }
    if (body.difficulty === 'easy' || body.difficulty === 'hard') {
      difficulty = body.difficulty
    }
  } catch {
    // No body or invalid JSON — fall through to legacy mark-done behavior
  }

  if (!difficulty) {
    // Legacy: mark completed_at only
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

  // New: mark with difficulty + compute and schedule next review

  // 1. Fetch current review
  const { data: current, error: fetchError } = await supabase
    .from('lc_reviews')
    .select('id, solve_id, scheduled_for')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !current) {
    return Response.json({ error: 'Review not found' }, { status: 404 })
  }

  // 2. Find the most recent previously completed review for this solve (to compute interval)
  const { data: prevReviews } = await supabase
    .from('lc_reviews')
    .select('scheduled_for')
    .eq('solve_id', current.solve_id)
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .lt('scheduled_for', current.scheduled_for)
    .order('scheduled_for', { ascending: false })
    .limit(1)

  const prevScheduledFor = prevReviews?.[0]?.scheduled_for
  const currentInterval = prevScheduledFor
    ? dateDiffDays(prevScheduledFor, current.scheduled_for)
    : 0

  const nextInterval = computeNextInterval(currentInterval, difficulty)
  const nextScheduledFor = addDays(getTodayLocal(), nextInterval)

  // 3. Mark current review complete
  const { data, error: updateError } = await supabase
    .from('lc_reviews')
    .update({ completed_at: new Date().toISOString(), difficulty })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, completed_at, difficulty')
    .single()

  if (updateError) {
    console.error('[PATCH /api/dsa/reviews/[id]]', updateError)
    return Response.json({ error: 'Failed to complete review' }, { status: 500 })
  }

  // 4. Schedule next review
  await supabase.from('lc_reviews').insert({
    solve_id: current.solve_id,
    user_id: user.id,
    scheduled_for: nextScheduledFor,
  })

  return Response.json({ ...data, next_scheduled_for: nextScheduledFor })
}
