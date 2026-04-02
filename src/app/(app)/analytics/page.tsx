'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '1y'

interface AnalyticsData {
  stats: {
    totalApplications: number
    submitted: number
    inPipeline: number
    responseRate: number
    offers: number
    jobsInRange: number
  }
  applicationActivity: Array<{ date: string; count: number }>
  funnel: Array<{ status: string; count: number }>
  jobActivity: Array<{ date: string; count: number }>
  topCompanies: Array<{ company: string; count: number }>
  sourceBreakdown: { github: number; manual: number }
  medianDaysToResponse: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  phone_screen: 'Phone screen',
  technical: 'Technical',
  final: 'Final round',
  offer: 'Offer',
  rejected: 'Rejected',
}

const STATUS_COLORS: Record<string, string> = {
  saved: '#52525b',
  applied: '#6366f1',
  phone_screen: '#8b5cf6',
  technical: '#a78bfa',
  final: '#f59e0b',
  offer: '#10b981',
  rejected: '#ef4444',
}

function formatDate(dateStr: string, range: Range): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (range === '1y') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function tickEvery(data: Array<{ date: string }>, n: number): string[] {
  return data.filter((_, i) => i % n === 0).map((d) => d.date)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 space-y-1">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-semibold text-zinc-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  color: '#e4e4e7',
  fontSize: 12,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics?range=${range}`)
      .then((r) => r.json())
      .then((d) => { setData(d as AnalyticsData); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range])

  const tickInterval = range === '1y' ? 30 : range === '30d' ? 5 : 1

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Analytics</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Your job search at a glance</p>
          </div>
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {(['7d', '30d', '1y'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  range === r ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {r === '7d' ? '7 days' : r === '30d' ? '30 days' : '1 year'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <AnalyticsSkeleton />
        ) : !data ? (
          <p className="text-sm text-zinc-500">Failed to load analytics.</p>
        ) : (
          <>
            {/* Stat cards */}
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

            {/* Application activity */}
            <div className="space-y-4">
              <SectionHeader title="Application activity" sub={`Applications submitted per day — ${range}`} />
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 pt-5 pb-2">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.applicationActivity} barSize={range === '1y' ? 3 : 8}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => formatDate(v as string, range)}
                      ticks={tickEvery(data.applicationActivity, tickInterval)}
                      tick={{ fill: '#52525b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelFormatter={(v) => formatDate(v as string, range)}
                      formatter={(v) => [v, 'Applications']}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Funnel + response rate */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Pipeline funnel */}
              <div className="space-y-4">
                <SectionHeader title="Pipeline funnel" sub="All applications by stage" />
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 pt-5 pb-2">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={data.funnel}
                      layout="vertical"
                      barSize={14}
                      margin={{ left: 0, right: 16 }}
                    >
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="status"
                        tickFormatter={(v) => STATUS_LABELS[v as string] ?? v}
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={90}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        labelFormatter={(v) => STATUS_LABELS[v as string] ?? v}
                        formatter={(v) => [v, 'Applications']}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      />
                      <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                        {data.funnel.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status] ?? '#52525b'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Response rate breakdown */}
              <div className="space-y-4">
                <SectionHeader title="Outcomes" sub="Of all applications submitted" />
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4 h-[240px] flex flex-col justify-center">
                  {data.stats.submitted === 0 ? (
                    <p className="text-sm text-zinc-600 text-center">No applications submitted yet</p>
                  ) : (
                    <>
                      <OutcomeRow
                        label="Got a response"
                        value={data.stats.responseRate}
                        color="bg-indigo-500"
                      />
                      <OutcomeRow
                        label="Reached final round"
                        value={Math.round(
                          (data.funnel.find((f) => f.status === 'final')?.count ?? 0) /
                          data.stats.submitted * 100
                        )}
                        color="bg-amber-500"
                      />
                      <OutcomeRow
                        label="Received offer"
                        value={Math.round(data.stats.offers / data.stats.submitted * 100)}
                        color="bg-emerald-500"
                      />
                      {data.medianDaysToResponse !== null && (
                        <p className="text-xs text-zinc-600 pt-1">
                          Median time to first response: <span className="text-zinc-400">{data.medianDaysToResponse} days</span>
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Jobs in feed */}
            <div className="space-y-4">
              <SectionHeader
                title="Jobs in feed"
                sub={`New jobs posted per day — ${data.stats.jobsInRange.toLocaleString()} total in this period`}
              />
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 pt-5 pb-2">
                <ResponsiveContainer width="100%" height={130}>
                  <AreaChart data={data.jobActivity}>
                    <defs>
                      <linearGradient id="jobGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => formatDate(v as string, range)}
                      ticks={tickEvery(data.jobActivity, tickInterval)}
                      tick={{ fill: '#52525b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelFormatter={(v) => formatDate(v as string, range)}
                      formatter={(v) => [v, 'Jobs posted']}
                      cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      fill="url(#jobGradient)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top companies + source breakdown */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Top companies */}
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
                              style={{
                                width: `${Math.round((c.count / (data.topCompanies[0]?.count ?? 1)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Source breakdown */}
              <div className="space-y-4">
                <SectionHeader title="Feed breakdown" sub={`Where your jobs came from — ${range}`} />
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-5 h-full flex flex-col justify-center">
                  {data.stats.jobsInRange === 0 ? (
                    <p className="text-sm text-zinc-600 text-center">No jobs in this period</p>
                  ) : (
                    <>
                      <SourceRow
                        label="Aggregated feed"
                        sub="SimplifyJobs GitHub sources"
                        count={data.sourceBreakdown.github}
                        total={data.stats.jobsInRange}
                        color="bg-indigo-500"
                      />
                      <SourceRow
                        label="Manually added"
                        sub="Pasted URLs or extension"
                        count={data.sourceBreakdown.manual}
                        total={data.stats.jobsInRange}
                        color="bg-zinc-500"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  )
}

// ─── Outcome row ──────────────────────────────────────────────────────────────

function OutcomeRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-xs font-semibold text-zinc-200 tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

// ─── Source row ───────────────────────────────────────────────────────────────

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
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-zinc-900 border border-zinc-800" />
        ))}
      </div>
      <div className="h-44 rounded-xl bg-zinc-900 border border-zinc-800" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-56 rounded-xl bg-zinc-900 border border-zinc-800" />
        <div className="h-56 rounded-xl bg-zinc-900 border border-zinc-800" />
      </div>
      <div className="h-36 rounded-xl bg-zinc-900 border border-zinc-800" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-56 rounded-xl bg-zinc-900 border border-zinc-800" />
        <div className="h-56 rounded-xl bg-zinc-900 border border-zinc-800" />
      </div>
    </div>
  )
}
