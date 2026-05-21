'use client'

import { useEffect, useState } from 'react'
import type { CompBand } from '@/lib/salary/comp-bands'

interface SalaryContext {
  job: { title?: string | null; company?: string | null }
  band: CompBand
  comp_target: number | null
  scripts?: string
}

function money(value: number): string {
  return `$${value.toLocaleString()}`
}

export function SalaryPlaybook({ applicationId }: { applicationId: string }) {
  const [context, setContext] = useState<SalaryContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/prep/salary-playbook?application_id=${encodeURIComponent(applicationId)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: SalaryContext | null) => setContext(data))
      .catch(() => {})
  }, [applicationId])

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/prep/salary-playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      })
      const data = await res.json().catch(() => null) as SalaryContext | { error?: string } | null
      if (!res.ok) {
        setError(data && 'error' in data && data.error ? data.error : 'Could not generate playbook')
        return
      }
      setContext(data as SalaryContext)
    } finally {
      setLoading(false)
    }
  }

  if (!context) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Salary Playbook</h3>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
        >
          {loading ? 'Generating…' : context.scripts ? 'Regenerate' : 'Generate scripts'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/10 px-3 py-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-[10px] text-zinc-600">P25</p><p className="text-xs text-zinc-300">{money(context.band.p25)}</p></div>
          <div><p className="text-[10px] text-zinc-600">P50</p><p className="text-xs text-zinc-100">{money(context.band.p50)}</p></div>
          <div><p className="text-[10px] text-zinc-600">P75</p><p className="text-xs text-zinc-300">{money(context.band.p75)}</p></div>
        </div>
        {context.comp_target && (
          <p className="mt-2 text-center text-[11px] text-emerald-400">Target: {money(context.comp_target)}</p>
        )}
        {context.scripts && (
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-zinc-950/70 p-3 text-xs leading-relaxed text-zinc-300">{context.scripts}</pre>
        )}
      </div>
    </div>
  )
}
