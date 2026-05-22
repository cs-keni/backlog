import { createClient } from '@/lib/supabase/server'
import { getTodayLocal } from '@/lib/dsa/schedule'
import {
  getQuestionById,
  isPrepBank,
  isQuestionStatus,
  type PrepBank,
  type QuestionStatus,
} from '@/lib/prep/banks'

interface ProgressBody {
  question_id?: unknown
  bank?: unknown
  status?: unknown
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('question_progress')
    .select('id, question_id, bank, status, last_reviewed_at, updated_at, created_at')
    .eq('user_id', user.id)

  if (error) {
    console.error('[GET /api/prep/question-progress]', error)
    return Response.json({ error: 'Failed to fetch question progress' }, { status: 500 })
  }

  return Response.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: ProgressBody
  try {
    body = await request.json() as ProgressBody
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!isPrepBank(body.bank) || !isQuestionStatus(body.status) || typeof body.question_id !== 'string') {
    return Response.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }

  const bank: PrepBank = body.bank
  const status: QuestionStatus = body.status
  const questionId = body.question_id

  if (!getQuestionById(bank, questionId)) {
    return Response.json({ error: 'Question not found' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('question_progress')
    .upsert(
      {
        user_id: user.id,
        question_id: questionId,
        bank,
        status,
        last_reviewed_at: now,
      },
      { onConflict: 'user_id,question_id' }
    )
    .select('id, question_id, bank, status, last_reviewed_at, updated_at, created_at')
    .single()

  if (error) {
    console.error('[POST /api/prep/question-progress] upsert', error)
    return Response.json({ error: 'Failed to save question progress' }, { status: 500 })
  }

  if (status === 'studied') {
    const { data: existingReview } = await supabase
      .from('prep_reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .maybeSingle()

    if (!existingReview) {
      const { error: reviewError } = await supabase.from('prep_reviews').insert({
        user_id: user.id,
        question_id: questionId,
        bank,
        interval_days: 1,
        next_review_at: getTodayLocal(),
      })

      if (reviewError) {
        console.error('[POST /api/prep/question-progress] prep review', reviewError)
        return Response.json({ error: 'Failed to create prep review' }, { status: 500 })
      }
    }
  }

  return Response.json(data)
}
