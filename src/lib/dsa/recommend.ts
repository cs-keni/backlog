import { NEETCODE_250, PATTERNS, TRACK_PROBLEMS } from './neetcode150'
import type { DsaTrack, NeetcodeProblem, Pattern } from './neetcode150'
import type { LcSolveWithReviews } from './types'

export const DAILY_NEW_TARGET = 2

const PATTERN_SET = new Set<string>(PATTERNS)

export function isValidPattern(p: string): p is Pattern {
  return PATTERN_SET.has(p)
}

function getTrackProblems(track: DsaTrack): NeetcodeProblem[] {
  const allowed = TRACK_PROBLEMS[track]
  return NEETCODE_250.filter(problem => allowed.has(problem.slug))
}

export function getActiveCategory(solves: LcSolveWithReviews[], track: DsaTrack = '150'): Pattern | null {
  const solvedSlugs = new Set(solves.map(s => s.problem_slug))
  const problems = getTrackProblems(track)

  // Try the most recent solve's pattern first (solves sorted desc by solved_at, created_at)
  const recentPattern = solves.map(s => s.pattern).find(isValidPattern)
  if (recentPattern) {
    const hasUnsolved = problems.some(
      p => p.pattern === recentPattern && !solvedSlugs.has(p.slug)
    )
    if (hasUnsolved) return recentPattern
  }

  // Walk PATTERNS in canonical order to find next category with unsolved problems
  for (const pattern of PATTERNS) {
    const hasUnsolved = problems.some(
      p => p.pattern === pattern && !solvedSlugs.has(p.slug)
    )
    if (hasUnsolved) return pattern
  }

  return null
}

export function getNextCategory(
  solves: LcSolveWithReviews[],
  currentPattern: Pattern,
  track: DsaTrack = '150'
): Pattern | null {
  const solvedSlugs = new Set(solves.map(s => s.problem_slug))
  const currentIndex = PATTERNS.indexOf(currentPattern)
  const problems = getTrackProblems(track)

  for (let i = currentIndex + 1; i < PATTERNS.length; i++) {
    const pattern = PATTERNS[i]
    const hasUnsolved = problems.some(
      p => p.pattern === pattern && !solvedSlugs.has(p.slug)
    )
    if (hasUnsolved) return pattern
  }

  return null
}

export function getRecommendations(
  solves: LcSolveWithReviews[],
  count = DAILY_NEW_TARGET,
  track: DsaTrack = '150'
): NeetcodeProblem[] {
  const results: NeetcodeProblem[] = []
  const solvedSlugs = new Set(solves.map(s => s.problem_slug))
  const problems = getTrackProblems(track)
  let category: Pattern | null = getActiveCategory(solves, track)

  while (results.length < count && category !== null) {
    const current = category
    const remaining = problems.filter(
      p => p.pattern === current && !solvedSlugs.has(p.slug)
    )
    results.push(...remaining.slice(0, count - results.length))

    if (results.length < count) {
      category = getNextCategory(solves, current, track)
    } else {
      break
    }
  }

  return results
}

export function getCategoryProgress(
  solves: LcSolveWithReviews[],
  pattern: Pattern,
  track: DsaTrack = '150'
): { solved: number; total: number } {
  const solvedSlugs = new Set(solves.map(s => s.problem_slug))
  const problems = getTrackProblems(track).filter(p => p.pattern === pattern)
  return {
    solved: problems.filter(p => solvedSlugs.has(p.slug)).length,
    total: problems.length,
  }
}
