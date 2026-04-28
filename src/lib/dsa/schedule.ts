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
