import { createClient } from '@/lib/supabase/server'
import { getTodayLocal } from '@/lib/dsa/schedule'
import { getQuestionById, isPrepBank } from '@/lib/prep/banks'

interface PrepReviewRow {
  id: string
  question_id: string
  bank: string
  interval_days: number
  next_review_at: string
  last_difficulty: 'easy' | 'hard' | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('prep_reviews')
    .select('id, question_id, bank, interval_days, next_review_at, last_difficulty')
    .eq('user_id', user.id)
    .lte('next_review_at', getTodayLocal())
    .order('next_review_at', { ascending: true })
    .limit(10)

  if (error) {
    console.error('[GET /api/prep/prep-reviews]', error)
    return Response.json({ error: 'Failed to fetch prep reviews' }, { status: 500 })
  }

  const reviews = ((data ?? []) as PrepReviewRow[])
    .map((review) => {
      if (!isPrepBank(review.bank)) return null
      const question = getQuestionById(review.bank, review.question_id)
      return question ? { ...review, question } : null
    })
    .filter((review): review is PrepReviewRow & { question: NonNullable<ReturnType<typeof getQuestionById>> } => review !== null)

  return Response.json(reviews)
}
