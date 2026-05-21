'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts'
import { AnalyticsFunnel } from '@/components/analytics/AnalyticsFunnel'
import { AnalyticsSkeleton } from '@/components/analytics/AnalyticsSection'
import { AnalyticsStats } from '@/components/analytics/AnalyticsStats'
import { CompanyGraph } from '@/components/analytics/CompanyGraph'
import { ConversionStats } from '@/components/analytics/ConversionStats'
import { FeedBreakdown, SourceYield } from '@/components/analytics/SourceYield'
import type { AnalyticsData, AnalyticsRange } from '@/components/analytics/types'
import type { CompanyGraphData } from '@/app/api/analytics/company-graph/route'

type Tab = 'charts' | 'map'

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('charts')
  const [range, setRange] = useState<AnalyticsRange>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [graphData, setGraphData] = useState<CompanyGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [graphLoading, setGraphLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics?range=${range}`)
      .then((r) => r.json())
      .then((d) => setData(d as AnalyticsData))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [range])

  useEffect(() => {
    if (tab !== 'map' || graphData || graphLoading) return
    setGraphLoading(true)
    fetch('/api/analytics/company-graph')
      .then((r) => r.json())
      .then((d) => setGraphData(d as CompanyGraphData))
      .catch(() => setGraphData(null))
      .finally(() => setGraphLoading(false))
  }, [graphData, graphLoading, tab])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Analytics</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Your job search at a glance</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              {(['charts', 'map'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tab === t ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab === t && (
                    <motion.span
                      layoutId="analytics-tab-pill"
                      className="absolute inset-0 rounded-md bg-zinc-700"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative capitalize">{t === 'charts' ? 'Charts' : 'Map'}</span>
                </button>
              ))}
            </div>
            <AnimatePresence>
              {tab === 'charts' && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1"
                >
                  {(['7d', '30d', '1y'] as AnalyticsRange[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        range === r ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {tab === 'map' && (
          <motion.div
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"
            style={{ height: 560 }}
          >
            <CompanyGraph data={graphData} isLoading={graphLoading} />
          </motion.div>
        )}

        {tab === 'charts' && (loading ? (
          <AnalyticsSkeleton />
        ) : !data ? (
          <p className="text-sm text-zinc-500">Failed to load analytics.</p>
        ) : (
          <>
            <AnalyticsStats data={data} />
            <AnalyticsCharts data={data} range={range} />
            <AnalyticsFunnel data={data} />
            <FeedBreakdown data={data} range={range} />
            <SourceYield data={data} />
            <ConversionStats data={data.conversionStats} />
          </>
        ))}
      </div>
    </div>
  )
}
