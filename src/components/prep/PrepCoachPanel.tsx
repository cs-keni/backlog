'use client'

import { useState } from 'react'

interface PrepCoachPanelProps {
  bank: 'system-design' | 'ai-engineer'
  questionId: string
}

const LABELS = {
  'system-design': {
    requirements: 'Requirements',
    capacity: 'Capacity',
    components: 'Components',
    bottlenecks: 'Bottlenecks',
    tradeoffs: 'Tradeoffs',
  },
  'ai-engineer': {
    framing: 'Framing',
    depth: 'Depth',
    tradeoffs: 'Tradeoffs',
    failures: 'Failures',
    production: 'Production',
  },
} as const

export function PrepCoachPanel({ bank, questionId }: PrepCoachPanelProps) {
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ scores: Record<string, number>; overall: string } | null>(null)

  async function evaluate() {
    if (!answer.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/prep/prep-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank, question_id: questionId, response_text: answer }),
      })
      const payload = await res.json().catch(() => null) as { scores?: Record<string, number>; overall?: string; error?: string } | null
      if (!res.ok || !payload?.scores || typeof payload.overall !== 'string') {
        setError(payload?.error ?? 'Evaluation failed')
        return
      }
      setResult({ scores: payload.scores, overall: payload.overall })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">AI Coach</h4>
        <span className="text-[11px] tabular-nums text-zinc-600">{answer.length}/5000</span>
      </div>
      <textarea
        value={answer}
        maxLength={5000}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Practice your answer here."
        className="mt-3 min-h-28 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={evaluate}
          disabled={loading || !answer.trim()}
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Evaluating...' : 'Evaluate'}
        </button>
        {result && (
          <button
            onClick={() => {
              setAnswer('')
              setResult(null)
              setError(null)
            }}
            className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
          >
            Try again
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {result && (
        <div className="mt-4 space-y-3">
          {Object.entries(LABELS[bank]).map(([key, label]) => {
            const score = result.scores[key] ?? 0
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">{label}</span>
                  <span className="tabular-nums text-zinc-500">{score}/10</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800">
                  <div className="h-1.5 rounded-full bg-emerald-400 transition-all" style={{ width: `${score * 10}%` }} />
                </div>
              </div>
            )
          })}
          <p className="rounded-md bg-zinc-900 px-3 py-2 text-sm leading-6 text-zinc-300">{result.overall}</p>
        </div>
      )}
    </div>
  )
}
