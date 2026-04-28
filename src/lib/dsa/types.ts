export interface LcSolve {
  id: string
  user_id: string
  problem_slug: string
  problem_title: string
  pattern: string
  difficulty: 'easy' | 'medium' | 'hard'
  solved_at: string
  created_at: string
}

export interface LcReview {
  id: string
  user_id: string
  solve_id: string
  scheduled_for: string
  completed_at: string | null
}

export interface LcSolveWithReviews extends LcSolve {
  lc_reviews: LcReview[]
}
