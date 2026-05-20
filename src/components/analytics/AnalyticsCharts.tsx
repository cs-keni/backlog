'use client'

import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SectionHeader } from './AnalyticsSection'
import type { AnalyticsData, AnalyticsRange } from './types'

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  color: '#e4e4e7',
  fontSize: 12,
}

function formatDate(dateStr: string, range: AnalyticsRange): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (range === '1y') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function tickEvery(data: Array<{ date: string }>, n: number): string[] {
  return data.filter((_, i) => i % n === 0).map((d) => d.date)
}

export function AnalyticsCharts({ data, range }: { data: AnalyticsData; range: AnalyticsRange }) {
  const tickInterval = range === '1y' ? 30 : range === '30d' ? 5 : 1

  return (
    <>
      <div className="space-y-4">
        <SectionHeader title="Application activity" sub={`Applications submitted per day - ${range}`} />
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

      <div className="space-y-4">
        <SectionHeader
          title="Jobs in feed"
          sub={`New jobs posted per day - ${data.stats.jobsInRange.toLocaleString()} total in this period`}
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
    </>
  )
}

