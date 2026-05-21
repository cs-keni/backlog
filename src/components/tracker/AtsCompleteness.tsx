'use client'

import { useState } from 'react'
import type { AtsPlatform } from '@/lib/tracker/ats-platform'

interface AtsCompletenessProps {
  applicationId: string
  platform: string | null
  score: number | null
  missing: string[]
}

const PLATFORM_OPTIONS: Array<{ value: AtsPlatform | 'unknown'; label: string }> = [
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'workday', label: 'Workday' },
  { value: 'lever', label: 'Lever' },
  { value: 'ashby', label: 'Ashby' },
  { value: 'icims', label: 'iCIMS' },
  { value: 'taleo', label: 'Taleo' },
  { value: 'unknown', label: 'Other' },
]

export function AtsCompleteness({ applicationId, platform, score, missing }: AtsCompletenessProps) {
  const [currentPlatform, setCurrentPlatform] = useState(platform)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const pct = score ?? 0

  async function updatePlatform(nextPlatform: string) {
    const prev = currentPlatform
    setCurrentPlatform(nextPlatform)
    setSaveError(false)
    setSaving(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}/ats-platform`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ats_platform: nextPlatform }),
      })
      if (!res.ok) {
        setCurrentPlatform(prev)
        setSaveError(true)
      }
    } catch {
      setCurrentPlatform(prev)
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  if (!currentPlatform) return null

  if (score === null) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">ATS Profile</h3>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
          <label className="text-[11px] text-zinc-500" htmlFor="ats-platform-select">Set ATS platform</label>
          <select
            id="ats-platform-select"
            value={currentPlatform}
            onChange={(event) => updatePlatform(event.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300"
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {saveError && <p className="mt-1 text-[11px] text-red-400">Failed to save — try again</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">ATS Profile</h3>
        <div className="flex flex-col items-end gap-0.5">
          <select
            value={currentPlatform}
            onChange={(event) => updatePlatform(event.target.value)}
            disabled={saving}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-400"
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {saveError && <p className="text-[10px] text-red-400">Failed to save</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r={radius} stroke="currentColor" strokeWidth="4" fill="none" className="text-zinc-800" />
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (pct / 100) * circumference}
            className={pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}
            strokeLinecap="round"
          />
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100">{score}% complete</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'Ready for this ATS'}
          </p>
        </div>
      </div>
    </div>
  )
}
