'use client'

import type { AnalyticsData } from './types'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 space-y-1">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-semibold text-zinc-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </div>
  )
}

export function AnalyticsStats({ data }: { data: AnalyticsData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Applications" value={data.stats.totalApplications} />
      <StatCard label="In pipeline" value={data.stats.inPipeline} sub="Active, not archived" />
      <StatCard
        label="Response rate"
        value={`${data.stats.responseRate}%`}
        sub={`${data.stats.submitted} submitted`}
      />
      <StatCard
        label="Offers"
        value={data.stats.offers}
        sub={data.medianDaysToResponse !== null ? `Median response: ${data.medianDaysToResponse}d` : undefined}
      />
    </div>
  )
}

