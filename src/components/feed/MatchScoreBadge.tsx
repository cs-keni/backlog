'use client'

import { useEffect, useState } from 'react'

interface MatchScoreBadgeProps {
  jobId: string
}

interface ScoreResult {
  score: number | null
  rationale: string | null
  mode: string
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'
  const stroke = score >= 70 ? 'stroke-emerald-400' : score >= 40 ? 'stroke-yellow-400' : 'stroke-red-400'
  const r = 14
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div className="relative w-10 h-10 shrink-0">
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-zinc-800" />
        <circle
          cx="18" cy="18" r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className={stroke}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-semibold ${color}`}>
        {score}%
      </span>
    </div>
  )
}

export function MatchScoreBadge({ jobId }: MatchScoreBadgeProps) {
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/jobs/${jobId}/match-score`)
      .then(r => r.json())
      .then((data: ScoreResult) => {
        if (!cancelled) {
          setResult(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [jobId])

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="w-10 h-10 rounded-full bg-zinc-800 animate-pulse shrink-0" />
        <div className="space-y-1.5">
          <div className="h-2.5 w-20 rounded bg-zinc-800 animate-pulse" />
          <div className="h-2 w-32 rounded bg-zinc-800 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!result || result.mode === 'none' || result.score === null) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-xs text-zinc-500">
          Add skills on your{' '}
          <a href="/profile" className="underline hover:text-zinc-300 transition-colors">Profile</a>
          {' '}page to see your match score.
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <ScoreRing score={result.score} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-200">
          {result.score >= 70 ? 'Strong match' : result.score >= 40 ? 'Partial match' : 'Weak match'}
          {result.mode === 'skills' && <span className="text-zinc-600 font-normal"> · skills only</span>}
        </p>
        {result.rationale && (
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{result.rationale}</p>
        )}
      </div>
    </div>
  )
}
