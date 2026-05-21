'use client'

import type { ConversionStats as ConversionStatsData } from '@/lib/analytics/conversion'

interface ConversionStatsProps {
  data: ConversionStatsData
}

function best<T extends { rate: number; applied: number }>(items: T[]): T | null {
  return items.length
    ? [...items].sort((a, b) => b.rate - a.rate || b.applied - a.applied)[0] ?? null
    : null
}

function labelSource(source: string): string {
  if (source === 'manual') return 'Manual'
  if (source === 'portal') return 'Portal'
  return 'Feed'
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-600">{detail}</p>
    </div>
  )
}

export function ConversionStats({ data }: ConversionStatsProps) {
  if (data.totalCallbacks < 5) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100">Conversion Insights</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-5 text-sm text-zinc-500">
          Apply to more jobs to unlock insights (need 5 callbacks)
        </div>
      </section>
    )
  }

  const bestTier = best(data.byTier)
  const bestTitle = best(data.byTitle)
  const bestSource = best(data.bySource)

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-100">Conversion Insights</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          label="Best tier"
          value={bestTier ? `${bestTier.tier} (${bestTier.rate}% callback)` : 'Not enough data'}
          detail={bestTier ? `${bestTier.callbacks}/${bestTier.applied} callbacks` : 'Need at least 2 applications'}
        />
        <StatCard
          label="Best title"
          value={bestTitle ? `${bestTitle.keyword} (${bestTitle.rate}%)` : 'Not enough data'}
          detail={bestTitle ? `${bestTitle.callbacks}/${bestTitle.applied} callbacks` : 'Need at least 2 applications'}
        />
        <StatCard
          label="Best source"
          value={bestSource ? `${labelSource(bestSource.source)} (${bestSource.rate}%)` : 'Not enough data'}
          detail={bestSource ? `${bestSource.callbacks}/${bestSource.applied} callbacks` : 'Need at least 2 applications'}
        />
      </div>
    </section>
  )
}
