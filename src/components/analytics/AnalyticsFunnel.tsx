'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SectionHeader } from './AnalyticsSection'
import type { AnalyticsData } from './types'

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

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  color: '#e4e4e7',
  fontSize: 12,
}

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

export function AnalyticsFunnel({ data }: { data: AnalyticsData }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-4">
        <SectionHeader title="Pipeline funnel" sub="All applications by stage" />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 pt-5 pb-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.funnel} layout="vertical" barSize={14} margin={{ left: 0, right: 16 }}>
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
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#52525b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader title="Outcomes" sub="Of all applications submitted" />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4 h-[240px] flex flex-col justify-center">
          {data.stats.submitted === 0 ? (
            <p className="text-sm text-zinc-600 text-center">No applications submitted yet</p>
          ) : (
            <>
              <OutcomeRow label="Got a response" value={data.stats.responseRate} color="bg-indigo-500" />
              <OutcomeRow
                label="Reached final round"
                value={Math.round(
                  ((data.funnel.find((f) => f.status === 'final')?.count ?? 0) / data.stats.submitted) * 100
                )}
                color="bg-amber-500"
              />
              <OutcomeRow label="Received offer" value={Math.round((data.stats.offers / data.stats.submitted) * 100)} color="bg-emerald-500" />
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
  )
}

