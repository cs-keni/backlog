'use client'

import { useEffect, useState } from 'react'
import { SectionHeader } from './AnalyticsSection'
import type { AnalyticsData, AnalyticsRange } from './types'
import { updateSourcePreferences, type SourcePreferences } from '@/lib/user/source-preferences'

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

function SourceYieldRow({
  row,
  preference,
  onPreference,
}: {
  row: AnalyticsData['sourceYield'][number]
  preference: SourcePreferences[string] | undefined
  onPreference: (source: string, action: 'pin' | 'hide' | 'reset') => void
}) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_repeat(5,minmax(64px,84px))] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-zinc-300 truncate">{row.label}</p>
          {preference && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              preference === 'pin' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {preference === 'pin' ? 'Pinned' : 'Hidden'}
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-600">
          {row.responseRate}% response · {row.interviewRate}% interview
        </p>
        <div className="mt-1 flex gap-1.5">
          <button
            onClick={() => onPreference(row.source, preference === 'pin' ? 'reset' : 'pin')}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:border-blue-500/40 hover:text-blue-400"
          >
            ☆ Pin
          </button>
          <button
            onClick={() => onPreference(row.source, preference === 'hide' ? 'reset' : 'hide')}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            × Hide
          </button>
        </div>
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
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4 h-full flex flex-col justify-center">
          {data.stats.jobsInRange === 0 ? (
            <p className="text-sm text-zinc-600 text-center">No jobs in this period</p>
          ) : (
            data.sourceBreakdown.map((row) => (
              <SourceRow
                key={row.key}
                label={`${row.icon} ${row.label}`}
                sub={row.group}
                count={row.count}
                total={data.stats.jobsInRange}
                color={row.color}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function SourceYield({ data }: { data: AnalyticsData }) {
  const [preferences, setPreferences] = useState<SourcePreferences>(data.sourcePreferences ?? {})

  useEffect(() => {
    setPreferences(data.sourcePreferences ?? {})
  }, [data.sourcePreferences])

  async function handlePreference(source: string, action: 'pin' | 'hide' | 'reset') {
    const previous = preferences
    const next = updateSourcePreferences(preferences, source, action)
    setPreferences(next)
    try {
      const res = await fetch('/api/user/source-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, action }),
      })
      if (!res.ok) setPreferences(previous)
    } catch {
      setPreferences(previous)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Source yield" sub="Application outcomes by source" />
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800/60 overflow-hidden">
        {data.sourceYield.every((row) => row.applications === 0) ? (
          <p className="text-sm text-zinc-600 px-4 py-6 text-center">No application source data yet</p>
        ) : (
          data.sourceYield.map((row) => (
            <SourceYieldRow
              key={row.source}
              row={row}
              preference={preferences[row.source]}
              onPreference={handlePreference}
            />
          ))
        )}
      </div>
    </div>
  )
}
