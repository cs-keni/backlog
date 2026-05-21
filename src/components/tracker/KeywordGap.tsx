'use client'

import { useEffect, useState } from 'react'
import type { KeywordGaps } from '@/lib/llm/keyword-gap'

interface KeywordGapRow {
  id: string
  gaps: KeywordGaps
  generated_at: string
}

function GapSection({ label, terms }: { label: string; terms: string[] }) {
  if (terms.length === 0) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {terms.map((term) => (
          <span key={term} className="rounded-full bg-red-950/40 px-2 py-0.5 text-[11px] text-red-400">
            {term}
          </span>
        ))}
      </div>
    </div>
  )
}

function GapSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3">
      {[40, 64, 52].map((w) => (
        <div key={w} className="space-y-1.5">
          <div className="h-2 w-12 animate-pulse rounded bg-zinc-700" />
          <div className="flex gap-1">
            <div className={`h-5 w-${w} animate-pulse rounded-full bg-zinc-800`} />
            <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function KeywordGap({ applicationId }: { applicationId: string }) {
  const [row, setRow] = useState<KeywordGapRow | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setInitialLoading(true)
    fetch(`/api/prep/keyword-gap?application_id=${encodeURIComponent(applicationId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: KeywordGapRow | null) => {
        if (!cancelled) setRow(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setInitialLoading(false)
      })
    return () => { cancelled = true }
  }, [applicationId])

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/prep/keyword-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      })
      const data = await res.json().catch(() => null) as KeywordGapRow | { error?: string } | null
      if (!res.ok) {
        setError(data && 'error' in data && data.error ? data.error : 'Could not analyze keywords')
        return
      }
      setRow(data as KeywordGapRow)
    } finally {
      setLoading(false)
    }
  }

  const hasGaps = row && [...row.gaps.skills, ...row.gaps.tools, ...row.gaps.verbs].length > 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Keyword Gaps</h3>
        {!initialLoading && (
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
          >
            {loading ? 'Analyzing…' : row ? 'Refresh' : 'Analyze'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {initialLoading && <GapSkeleton />}
      {!initialLoading && row && (
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3">
          {hasGaps ? (
            <>
              <GapSection label="Skills" terms={row.gaps.skills} />
              <GapSection label="Tools" terms={row.gaps.tools} />
              <GapSection label="Verbs" terms={row.gaps.verbs} />
            </>
          ) : (
            <p className="text-xs text-zinc-500">No obvious keyword gaps found.</p>
          )}
        </div>
      )}
    </div>
  )
}
