import { getCompanyTier } from '@/lib/tracker/company-tier'
import type { CompanyTier } from '@/lib/tracker/company-tier'

const CALLBACK_STATUSES = new Set(['phone_screen', 'technical', 'final', 'offer'])

export interface ConversionApplication {
  status: string
  title: string
  company: string
  source: string
}

export interface ConversionBucket {
  applied: number
  callbacks: number
  rate: number
}

export interface ConversionStats {
  byTier: Array<{ tier: CompanyTier } & ConversionBucket>
  byTitle: Array<{ keyword: string } & ConversionBucket>
  bySource: Array<{ source: string } & ConversionBucket>
  totalCallbacks: number
}

function titleKeyword(title: string): string {
  if (/\bprincipal\b/i.test(title)) return 'Principal'
  if (/\bstaff\b/i.test(title)) return 'Staff'
  if (/\bsenior|sr\.?\b/i.test(title)) return 'Senior'
  return 'Software Engineer'
}

function sourceKey(source: string | null | undefined): string {
  if (source === 'manual') return 'manual'
  if (source === 'portal') return 'portal'
  return 'github'
}

function emptyBucket(): ConversionBucket {
  return { applied: 0, callbacks: 0, rate: 0 }
}

function toRate(bucket: ConversionBucket): ConversionBucket {
  return {
    ...bucket,
    rate: bucket.applied > 0 ? Math.round((bucket.callbacks / bucket.applied) * 100) : 0,
  }
}

export function computeConversionStats(applications: ConversionApplication[]): ConversionStats {
  const tierCounts: Record<CompanyTier, ConversionBucket> = {
    faang: emptyBucket(),
    large: emptyBucket(),
    mid: emptyBucket(),
    startup: emptyBucket(),
  }
  const titleCounts = new Map<string, ConversionBucket>()
  const sourceCounts = new Map<string, ConversionBucket>()
  let totalCallbacks = 0

  for (const app of applications) {
    if (app.status === 'saved') continue

    const isCallback = CALLBACK_STATUSES.has(app.status)
    if (isCallback) totalCallbacks++

    const tier = getCompanyTier(app.company)
    tierCounts[tier].applied++
    if (isCallback) tierCounts[tier].callbacks++

    const keyword = titleKeyword(app.title)
    const titleBucket = titleCounts.get(keyword) ?? emptyBucket()
    titleBucket.applied++
    if (isCallback) titleBucket.callbacks++
    titleCounts.set(keyword, titleBucket)

    const source = sourceKey(app.source)
    const sourceBucket = sourceCounts.get(source) ?? emptyBucket()
    sourceBucket.applied++
    if (isCallback) sourceBucket.callbacks++
    sourceCounts.set(source, sourceBucket)
  }

  return {
    byTier: (Object.entries(tierCounts) as Array<[CompanyTier, ConversionBucket]>)
      .map(([tier, bucket]) => ({ tier, ...toRate(bucket) }))
      .filter(bucket => bucket.applied >= 2),
    byTitle: [...titleCounts.entries()]
      .map(([keyword, bucket]) => ({ keyword, ...toRate(bucket) }))
      .filter(bucket => bucket.applied >= 2),
    bySource: [...sourceCounts.entries()]
      .map(([source, bucket]) => ({ source, ...toRate(bucket) }))
      .filter(bucket => bucket.applied >= 2),
    totalCallbacks,
  }
}
