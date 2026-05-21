const DAY_MS = 86_400_000

function ageInDays(fetchedAt: string | null): number | null {
  if (!fetchedAt) return null
  const timestamp = new Date(fetchedAt).getTime()
  if (Number.isNaN(timestamp)) return null
  return Math.max(0, Math.floor((Date.now() - timestamp) / DAY_MS))
}

export function freshnessLabel(fetchedAt: string | null): string | null {
  const days = ageInDays(fetchedAt)
  if (days === null) return null
  if (days <= 1) return 'Posted today'
  if (days <= 7) return `Posted ${days}d ago`
  if (days <= 30) return `Posted ${Math.floor(days / 7)}w ago`
  return `Posted ${Math.floor(days / 30)}mo ago`
}

export function freshnessColor(fetchedAt: string | null): 'green' | 'yellow' | 'red' | null {
  const days = ageInDays(fetchedAt)
  if (days === null) return null
  if (days <= 7) return 'green'
  if (days <= 21) return 'yellow'
  return 'red'
}
