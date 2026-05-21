import type { CompanyTier } from './company-tier'

export const RESPONSE_WINDOW_DAYS: Record<CompanyTier, number> = {
  faang: 14,
  large: 21,
  mid: 10,
  startup: 7,
}

export type HealthStatus = 'green' | 'yellow' | 'red'

export function getApplicationHealth(appliedAt: string, tier: CompanyTier, now = Date.now()): HealthStatus {
  const appliedTime = new Date(appliedAt).getTime()
  if (Number.isNaN(appliedTime)) return 'green'

  const days = (now - appliedTime) / 86_400_000
  const window = RESPONSE_WINDOW_DAYS[tier]
  if (days < window * 0.8) return 'green'
  if (days < window) return 'yellow'
  return 'red'
}

export function getDaysSinceApplication(appliedAt: string, now = Date.now()): number {
  const appliedTime = new Date(appliedAt).getTime()
  if (Number.isNaN(appliedTime)) return 0
  return Math.max(0, Math.floor((now - appliedTime) / 86_400_000))
}
