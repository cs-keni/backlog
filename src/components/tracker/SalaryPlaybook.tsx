'use client'

import { useEffect, useState } from 'react'
import type { CompBand } from '@/lib/salary/comp-bands'

interface SalaryScripts {
  recruiter_call: string
  email_counter: string
  deadline_extension: string
}

interface SalaryContext {
  job: { title?: string | null; company?: string | null } | null
  band: CompBand
  comp_target: number | null
  scripts?: SalaryScripts
}

const SCRIPT_TABS: Array<{ key: keyof SalaryScripts; label: string }> = [
  { key: 'recruiter_call', label: 'Recruiter call' },
  { key: 'email_counter', label: 'Email counter' },
  { key: 'deadline_extension', label: 'Deadline extension' },
]

function money(value: number): string {
  return `$${value.toLocaleString()}`
}

function ScriptPanel({ scripts }: { scripts: SalaryScripts }) {
  const [active, setActive] = useState<keyof SalaryScripts>('recruiter_call')
  return (
    <div className="mt-3">
      <div className="flex gap-1 border-b border-zinc-800">
        {SCRIPT_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              active === key
                ? 'border-b-2 border-emerald-500 text-emerald-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <pre className="mt-2 whitespace-pre-wrap rounded-md bg-zinc-950/70 p-3 text-xs leading-relaxed text-zinc-300">
        {scripts[active] || <span className="text-zinc-600 italic">Not generated</span>}
      </pre>
    </div>
  )
}

function BandSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-4">
      <div className="flex justify-around">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="h-2.5 w-8 animate-pulse rounded bg-zinc-700" />
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-700" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SalaryPlaybook({ applicationId }: { applicationId: string }) {
  const [context, setContext] = useState<SalaryContext | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setInitialLoading(true)
    fetch(`/api/prep/salary-playbook?application_id=${encodeURIComponent(applicationId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SalaryContext | null) => {
        if (!cancelled) setContext(data)
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
      const res = await fetch('/api/prep/salary-playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      })
      const data = (await res.json().catch(() => null)) as SalaryContext | { error?: string } | null
      if (!res.ok) {
        setError(data && 'error' in data && data.error ? data.error : 'Could not generate playbook')
        return
      }
      setContext(data as SalaryContext)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Salary Playbook</h3>
        </div>
        <BandSkeleton />
      </div>
    )
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
          <div>
            <p className="text-[10px] text-zinc-600">P25</p>
            <p className="text-xs text-zinc-300">{money(context.band.p25)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600">P50</p>
            <p className="text-xs text-zinc-100">{money(context.band.p50)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600">P75</p>
            <p className="text-xs text-zinc-300">{money(context.band.p75)}</p>
          </div>
        </div>
        {context.comp_target && (
          <p className="mt-2 text-center text-[11px] text-emerald-400">Target: {money(context.comp_target)}</p>
        )}
        {context.scripts && <ScriptPanel scripts={context.scripts} />}
      </div>
    </div>
  )
}
