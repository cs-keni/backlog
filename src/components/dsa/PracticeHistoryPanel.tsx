'use client'

import { useEffect, useState } from 'react'

interface LcAttempt {
  problem_slug: string
  phase_reached: 'read' | 'brute_force' | 'pattern' | 'code'
  time_spent_sec: number
  hint_count: number
  language: 'python' | 'java' | 'js'
  nudge_count: number
  timeline: { phase_timings?: Partial<Record<string, number>> } | null
  created_at: string
}

const PHASE_LABELS: Record<string, string> = {
  read: 'Read',
  brute_force: 'Brute',
  pattern: 'Pattern',
  code: 'Code',
}

const PHASE_ORDER = ['read', 'brute_force', 'pattern', 'code']

function formatMin(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function slugToTitle(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function PhaseBar({ timings }: { timings: Partial<Record<string, number>> }) {
  const total = PHASE_ORDER.reduce((sum, p) => sum + (timings[p] ?? 0), 0)
  if (total === 0) return null

  const COLORS: Record<string, string> = {
    read:        '#6366f1',
    brute_force: '#f59e0b',
    pattern:     '#10b981',
    code:        '#3b82f6',
  }

  return (
    <div className="mt-2">
      <div className="flex h-1.5 overflow-hidden rounded-full gap-px">
        {PHASE_ORDER.map((phase) => {
          const t = timings[phase] ?? 0
          if (t === 0) return null
          const pct = (t / total) * 100
          return (
            <div
              key={phase}
              style={{ width: `${pct}%`, background: COLORS[phase] }}
              title={`${PHASE_LABELS[phase]}: ${formatMin(t)}`}
            />
          )
        })}
      </div>
      <div className="flex gap-3 mt-1.5 flex-wrap">
        {PHASE_ORDER.map((phase) => {
          const t = timings[phase] ?? 0
          if (t === 0) return null
          return (
            <span key={phase} className="text-[10px] text-zinc-500 flex items-center gap-1">
              <span style={{ background: COLORS[phase] }} className="inline-block w-1.5 h-1.5 rounded-full" />
              {PHASE_LABELS[phase]} {formatMin(t)}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function PracticeHistoryPanel() {
  const [attempts, setAttempts] = useState<LcAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dsa/attempts')
      .then((r) => r.json())
      .then((d) => setAttempts(d as LcAttempt[]))
      .catch(() => setAttempts([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-zinc-800/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (attempts.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-4 text-center">
        No practice sessions yet. Open a LeetCode problem with the extension to start.
      </p>
    )
  }

  // Summary stats
  const totalSessions = attempts.length
  const avgTime = Math.round(attempts.reduce((s, a) => s + a.time_spent_sec, 0) / totalSessions)
  const hintedCount = attempts.filter((a) => a.hint_count > 0).length

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Sessions', value: totalSessions },
          { label: 'Avg time', value: formatMin(avgTime) },
          { label: 'Used hints', value: `${hintedCount}/${totalSessions}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-center">
            <p className="text-base font-semibold tabular-nums text-zinc-100">{value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent attempts */}
      <div className="space-y-2">
        {attempts.slice(0, 20).map((a, i) => {
          const phaseTimings = a.timeline?.phase_timings ?? {}
          const date = new Date(a.created_at)
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

          return (
            <div
              key={i}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">
                    {slugToTitle(a.problem_slug)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-zinc-500">
                      reached <span className="text-zinc-400">{PHASE_LABELS[a.phase_reached] ?? a.phase_reached}</span>
                    </span>
                    <span className="text-[10px] text-zinc-600">·</span>
                    <span className="text-[10px] text-zinc-500">{formatMin(a.time_spent_sec)} total</span>
                    {a.hint_count > 0 && (
                      <>
                        <span className="text-[10px] text-zinc-600">·</span>
                        <span className="text-[10px] text-zinc-500">{a.hint_count} hint{a.hint_count !== 1 ? 's' : ''}</span>
                      </>
                    )}
                    <span className="text-[10px] text-zinc-600">·</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{a.language}</span>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0 mt-0.5">{dateStr}</span>
              </div>

              {Object.keys(phaseTimings).length > 0 && (
                <PhaseBar timings={phaseTimings} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
