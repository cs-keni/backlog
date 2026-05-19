import { describe, it, expect } from 'vitest'
import {
  isValidPattern,
  getActiveCategory,
  getRecommendations,
  getCategoryProgress,
  DAILY_NEW_TARGET,
} from '@/lib/dsa/recommend'
import { PATTERNS, NEETCODE_150 } from '@/lib/dsa/neetcode150'
import type { LcSolveWithReviews } from '@/lib/dsa/types'

function makeSolve(slug: string, pattern: string, daysAgo = 0): LcSolveWithReviews {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return {
    id: `solve-${slug}`,
    user_id: 'user-1',
    problem_slug: slug,
    problem_title: slug,
    pattern,
    difficulty: 'medium',
    solved_at: d.toLocaleDateString('en-CA'),
    created_at: d.toISOString(),
    lc_reviews: [],
  }
}

describe('isValidPattern', () => {
  it('returns true for a known pattern', () => {
    expect(isValidPattern(PATTERNS[0])).toBe(true)
  })

  it('returns false for an unknown string', () => {
    expect(isValidPattern('not-a-real-pattern')).toBe(false)
  })
})

describe('getActiveCategory', () => {
  it('returns the first PATTERNS category when no solves exist', () => {
    expect(getActiveCategory([])).toBe(PATTERNS[0])
  })

  it('infers active category from the most recent solve', () => {
    const pattern = PATTERNS[3]
    const problem = NEETCODE_150.find(p => p.pattern === pattern)!
    expect(getActiveCategory([makeSolve(problem.slug, pattern)])).toBe(pattern)
  })

  it('auto-advances to the next category when the active one is fully solved', () => {
    const pattern0Problems = NEETCODE_150.filter(p => p.pattern === PATTERNS[0])
    const solves = pattern0Problems.map(p => makeSolve(p.slug, PATTERNS[0]))
    expect(getActiveCategory(solves)).toBe(PATTERNS[1])
  })

  it('returns null when all 150 problems are solved', () => {
    const solves = NEETCODE_150.map(p => makeSolve(p.slug, p.pattern))
    expect(getActiveCategory(solves)).toBeNull()
  })
})

describe('getRecommendations', () => {
  it('returns DAILY_NEW_TARGET problems from the first category when no solves exist', () => {
    const recs = getRecommendations([])
    expect(recs).toHaveLength(DAILY_NEW_TARGET)
    expect(recs.every(p => p.pattern === PATTERNS[0])).toBe(true)
  })

  it('returns an empty array when all 150 problems are solved', () => {
    const solves = NEETCODE_150.map(p => makeSolve(p.slug, p.pattern))
    expect(getRecommendations(solves)).toHaveLength(0)
  })

  it('crosses category boundary to fill count when current category has only 1 left', () => {
    const pattern0Problems = NEETCODE_150.filter(p => p.pattern === PATTERNS[0])
    // Solve all but the last problem in PATTERNS[0]
    const solves = pattern0Problems.slice(0, -1).map(p => makeSolve(p.slug, p.pattern))
    const recs = getRecommendations(solves, 2)
    expect(recs).toHaveLength(2)
    expect(recs[0].pattern).toBe(PATTERNS[0])
    expect(recs[1].pattern).toBe(PATTERNS[1])
  })
})

describe('getCategoryProgress', () => {
  it('returns 0/total when no problems in the category are solved', () => {
    const pattern = PATTERNS[0]
    const total = NEETCODE_150.filter(p => p.pattern === pattern).length
    expect(getCategoryProgress([], pattern)).toEqual({ solved: 0, total })
  })

  it('returns the correct solved count for a partially solved category', () => {
    const pattern = PATTERNS[0]
    const problems = NEETCODE_150.filter(p => p.pattern === pattern)
    const solves = problems.slice(0, 3).map(p => makeSolve(p.slug, p.pattern))
    const progress = getCategoryProgress(solves, pattern)
    expect(progress.solved).toBe(3)
    expect(progress.total).toBe(problems.length)
  })
})
