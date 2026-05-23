'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

interface ProgressRow {
  question_id: string
  bank: 'system-design' | 'ai-engineer'
  status: 'unstudied' | 'studied' | 'needs-review'
}

interface SolveRow {
  id: string
}

function MiniRing({ label, value, scrollTarget, href }: {
  label: string
  value: number
  scrollTarget?: string
  href?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const inner = (
    <div className="flex items-center gap-3">
      <div
        className="grid h-12 w-12 place-items-center rounded-full"
        style={{ background: `conic-gradient(#818cf8 ${pct}%, #27272a ${pct}%)` }}
      >
        <div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-950">
          <span className="text-[11px] font-semibold tabular-nums text-zinc-200">{Math.round(pct)}%</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-[11px] text-zinc-600">{href ? 'Go to section' : 'Jump to section'}</p>
      </div>
    </div>
  )
  const cls = "rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-left hover:border-zinc-700"
  if (href) {
    return <Link href={href} className={cls}>{inner}</Link>
  }
  return (
    <button
      onClick={() => scrollTarget && document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className={cls}
    >
      {inner}
    </button>
  )
}

export function UnifiedProgressDashboard() {
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([])
  const [solves, setSolves] = useState<SolveRow[]>([])
  const [dsaTotal, setDsaTotal] = useState(143) // non-premium 150-track default
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [progressRes, solvesRes, trackRes] = await Promise.all([
        fetch('/api/prep/question-progress'),
        fetch('/api/dsa/solves'),
        fetch('/api/dsa/track'),
      ])
      if (progressRes.ok) setProgressRows(await progressRes.json() as ProgressRow[])
      if (solvesRes.ok) setSolves(await solvesRes.json() as SolveRow[])
      if (trackRes.ok) {
        const { total } = await trackRes.json() as { track: string; total: number }
        if (typeof total === 'number' && total > 0) setDsaTotal(total)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    function onChanged() {
      void load()
    }
    window.addEventListener('prep-progress-changed', onChanged)
    return () => window.removeEventListener('prep-progress-changed', onChanged)
  }, [])

  const stats = useMemo(() => {
    const covered = (bank: ProgressRow['bank']) =>
      progressRows.filter((row) =>
        row.bank === bank && (row.status === 'studied' || row.status === 'needs-review')
      ).length
    return {
      dsa: (solves.length / dsaTotal) * 100,
      sd: (covered('system-design') / 124) * 100,
      ai: (covered('ai-engineer') / 60) * 100,
    }
  }, [progressRows, solves.length, dsaTotal])

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Prep Progress</h2>
        <p className="mt-1 text-xs text-zinc-500">DSA, system design, and AI engineer coverage.</p>
      </div>
      {loading ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-20 rounded-lg bg-zinc-800/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniRing label="DSA" value={stats.dsa} href="/dsa" />
          <MiniRing label="System Design" value={stats.sd} scrollTarget="system-design" />
          <MiniRing label="AI Engineer" value={stats.ai} scrollTarget="ai-engineer" />
        </div>
      )}
    </section>
  )
}
