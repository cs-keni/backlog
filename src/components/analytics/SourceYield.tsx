'use client'

import { SectionHeader } from './AnalyticsSection'
import type { AnalyticsData, AnalyticsRange } from './types'

function SourceRow({
  label, sub, count, total, color,
}: {
  label: string; sub: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-300">{label}</p>
          <p className="text-[11px] text-zinc-600">{sub}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-zinc-100 tabular-nums">{count.toLocaleString()}</p>
          <p className="text-[11px] text-zinc-600">{pct}%</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SourceYieldMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 md:block md:text-right">
      <span className="text-[11px] text-zinc-600">{label}</span>
      <span className="text-sm font-semibold text-zinc-100 tabular-nums md:block">{value.toLocaleString()}</span>
    </div>
  )
}

function SourceYieldRow({ row }: { row: AnalyticsData['sourceYield'][number] }) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_repeat(5,minmax(64px,84px))] md:items-center">
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-300 truncate">{row.label}</p>
        <p className="text-[11px] text-zinc-600">
          {row.responseRate}% response · {row.interviewRate}% interview
        </p>
      </div>
      <SourceYieldMetric label="Apps" value={row.applications} />
      <SourceYieldMetric label="Sent" value={row.submitted} />
      <SourceYieldMetric label="Replies" value={row.responses} />
      <SourceYieldMetric label="Interviews" value={row.interviews} />
      <SourceYieldMetric label="Offers" value={row.offers} />
    </div>
  )
}

export function FeedBreakdown({ data, range }: { data: AnalyticsData; range: AnalyticsRange }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-4">
        <SectionHeader title="Most active companies" sub={`Top hiring in the last ${range}`} />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800/60 overflow-hidden">
          {data.topCompanies.length === 0 ? (
            <p className="text-sm text-zinc-600 px-4 py-6 text-center">No data</p>
          ) : (
            data.topCompanies.map((c, i) => (
              <div key={c.company} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[11px] text-zinc-600 w-4 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-zinc-300 truncate">{c.company}</span>
                    <span className="text-xs text-zinc-500 tabular-nums shrink-0">{c.count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500/60"
                      style={{ width: `${Math.round((c.count / (data.topCompanies[0]?.count ?? 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader title="Feed breakdown" sub={`Where your jobs came from - ${range}`} />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-5 h-full flex flex-col justify-center">
          {data.stats.jobsInRange === 0 ? (
            <p className="text-sm text-zinc-600 text-center">No jobs in this period</p>
          ) : (
            <>
              <SourceRow label="Aggregated feed" sub="SimplifyJobs GitHub sources" count={data.sourceBreakdown.github} total={data.stats.jobsInRange} color="bg-indigo-500" />
              <SourceRow label="Company/search discovery" sub="Portal scan and Brave Search" count={data.sourceBreakdown.portal} total={data.stats.jobsInRange} color="bg-emerald-500" />
              <SourceRow label="Manually added" sub="Pasted URLs or extension" count={data.sourceBreakdown.manual} total={data.stats.jobsInRange} color="bg-zinc-500" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function SourceYield({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Source yield" sub="Application outcomes by source" />
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800/60 overflow-hidden">
        {data.sourceYield.every((row) => row.applications === 0) ? (
          <p className="text-sm text-zinc-600 px-4 py-6 text-center">No application source data yet</p>
        ) : (
          data.sourceYield.map((row) => <SourceYieldRow key={row.source} row={row} />)
        )}
      </div>
    </div>
  )
}

