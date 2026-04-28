import { createClient } from '@/lib/supabase/server'
import { computeReviewDates } from '@/lib/dsa/schedule'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('lc_solves')
    .select('*, lc_reviews(*)')
    .eq('user_id', user.id)
    .order('solved_at', { ascending: false })

  if (error) {
    console.error('[GET /api/dsa/solves]', error)
    return Response.json({ error: 'Failed to fetch solves' }, { status: 500 })
  }

  return Response.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    problem_slug?: unknown
    problem_title?: unknown
    pattern?: unknown
    difficulty?: unknown
    solved_at?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (
    typeof body.problem_slug !== 'string' ||
    typeof body.problem_title !== 'string' ||
    typeof body.pattern !== 'string' ||
    typeof body.difficulty !== 'string' ||
    typeof body.solved_at !== 'string'
  ) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const validDifficulties = ['easy', 'medium', 'hard']
  if (!validDifficulties.includes(body.difficulty)) {
    return Response.json({ error: 'Invalid difficulty' }, { status: 400 })
  }

  // Delete all pending (uncompleted) reviews for this problem to reset the chain
  const { data: existingSolve } = await supabase
    .from('lc_solves')
    .select('id')
    .eq('user_id', user.id)
    .eq('problem_slug', body.problem_slug)
    .maybeSingle()

  if (existingSolve) {
    await supabase
      .from('lc_reviews')
      .delete()
      .eq('solve_id', existingSolve.id)
      .is('completed_at', null)
  }

  // Upsert the solve row (one per user + problem)
  const { data: solve, error: solveError } = await supabase
    .from('lc_solves')
    .upsert(
      {
        user_id: user.id,
        problem_slug: body.problem_slug,
        problem_title: body.problem_title,
        pattern: body.pattern,
        difficulty: body.difficulty,
        solved_at: body.solved_at,
      },
      { onConflict: 'user_id,problem_slug' }
    )
    .select('id')
    .single()

  if (solveError || !solve) {
    console.error('[POST /api/dsa/solves] upsert', solveError)
    return Response.json({ error: 'Failed to save solve' }, { status: 500 })
  }

  // Insert 5 review rows
  const reviewDates = computeReviewDates(body.solved_at)
  const reviews = reviewDates.map((scheduled_for) => ({
    user_id: user.id,
    solve_id: solve.id,
    scheduled_for,
  }))

  const { error: reviewsError } = await supabase.from('lc_reviews').insert(reviews)

  if (reviewsError) {
    console.error('[POST /api/dsa/solves] reviews insert', reviewsError)
    return Response.json({ error: 'Failed to schedule reviews' }, { status: 500 })
  }

  return Response.json({ id: solve.id }, { status: 201 })
}
