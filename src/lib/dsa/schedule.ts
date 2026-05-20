export const SR_INTERVALS_DAYS = [0, 1, 3, 7, 14] as const

export function computeReviewDates(solvedAt: string): string[] {
  const [year, month, day] = solvedAt.split('-').map(Number)
  return SR_INTERVALS_DAYS.map((days) => {
    const d = new Date(year, month - 1, day + days)
    return d.toLocaleDateString('en-CA')
  })
}

export function getTodayLocal(): string {
  return new Date().toLocaleDateString('en-CA')
}

// ─── Leitner adaptive SR ──────────────────────────────────────────────────────

export const LEITNER_INTERVALS = [1, 3, 7, 14, 30] as const

/**
 * Returns the next review interval (in days) based on difficulty.
 * Easy: advance to the next step in the Leitner ladder (cap at 30).
 * Hard: reset to 1.
 */
export function computeNextInterval(currentInterval: number, difficulty: 'easy' | 'hard'): number {
  if (difficulty === 'hard') return 1
  const idx = LEITNER_INTERVALS.findIndex((n) => n >= currentInterval)
  if (idx === -1) return 30
  const nextIdx = Math.min(idx + 1, LEITNER_INTERVALS.length - 1)
  return LEITNER_INTERVALS[nextIdx]
}

export function dateDiffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86_400_000
  )
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA')
}
