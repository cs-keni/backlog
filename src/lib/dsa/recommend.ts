import { NEETCODE_150, PATTERNS } from './neetcode150'
import type { NeetcodeProblem, Pattern } from './neetcode150'
import type { LcSolveWithReviews } from './types'

export const DAILY_NEW_TARGET = 2

const PATTERN_SET = new Set<string>(PATTERNS)

export function isValidPattern(p: string): p is Pattern {
  return PATTERN_SET.has(p)
}

export function getActiveCategory(solves: LcSolveWithReviews[]): Pattern | null {
  const solvedSlugs = new Set(solves.map(s => s.problem_slug))

  // Try the most recent solve's pattern first (solves sorted desc by solved_at, created_at)
  const recentPattern = solves.map(s => s.pattern).find(isValidPattern)
  if (recentPattern) {
    const hasUnsolved = NEETCODE_150.some(
      p => p.pattern === recentPattern && !solvedSlugs.has(p.slug)
    )
    if (hasUnsolved) return recentPattern
  }

  // Walk PATTERNS in canonical order to find next category with unsolved problems
  for (const pattern of PATTERNS) {
    const hasUnsolved = NEETCODE_150.some(
      p => p.pattern === pattern && !solvedSlugs.has(p.slug)
    )
    if (hasUnsolved) return pattern
  }

  return null
}

export function getNextCategory(
  solves: LcSolveWithReviews[],
  currentPattern: Pattern
): Pattern | null {
  const solvedSlugs = new Set(solves.map(s => s.problem_slug))
  const currentIndex = PATTERNS.indexOf(currentPattern)

  for (let i = currentIndex + 1; i < PATTERNS.length; i++) {
    const pattern = PATTERNS[i]
    const hasUnsolved = NEETCODE_150.some(
      p => p.pattern === pattern && !solvedSlugs.has(p.slug)
    )
    if (hasUnsolved) return pattern
  }

  return null
}

export function getRecommendations(
  solves: LcSolveWithReviews[],
  count = DAILY_NEW_TARGET
): NeetcodeProblem[] {
  const results: NeetcodeProblem[] = []
  const solvedSlugs = new Set(solves.map(s => s.problem_slug))
  let category: Pattern | null = getActiveCategory(solves)

  while (results.length < count && category !== null) {
    const current = category
    const remaining = NEETCODE_150.filter(
      p => p.pattern === current && !solvedSlugs.has(p.slug)
    )
    results.push(...remaining.slice(0, count - results.length))

    if (results.length < count) {
      category = getNextCategory(solves, current)
    } else {
      break
    }
  }

  return results
}

export function getCategoryProgress(
  solves: LcSolveWithReviews[],
  pattern: Pattern
): { solved: number; total: number } {
  const solvedSlugs = new Set(solves.map(s => s.problem_slug))
  const problems = NEETCODE_150.filter(p => p.pattern === pattern)
  return {
    solved: problems.filter(p => solvedSlugs.has(p.slug)).length,
    total: problems.length,
  }
}
