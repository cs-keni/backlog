'use client'

import { useEffect, useState } from 'react'

interface ResumeVersion {
  id: string
  pdf_url: string
  created_at?: string
}

interface ResumeTailorProps {
  jobId: string
}

export function ResumeTailor({ jobId }: ResumeTailorProps) {
  const [version, setVersion] = useState<ResumeVersion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    fetch(`/api/resume/tailor?job_id=${encodeURIComponent(jobId)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: ResumeVersion | null) => {
        if (!cancelled) setVersion(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [jobId])

  async function tailor() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/resume/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      })
      const data = await res.json().catch(() => null) as ResumeVersion | { error?: string } | null
      if (!res.ok) {
        setError(data && 'error' in data && data.error ? data.error : 'Could not tailor resume')
        return
      }
      const nextVersion = data as ResumeVersion
      setVersion(nextVersion)
      if (nextVersion.pdf_url) window.open(nextVersion.pdf_url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Could not reach server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Resume Tailor
          </h3>
          {version?.created_at && (
            <p className="mt-0.5 text-[11px] text-zinc-600">
              Last generated {new Date(version.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
        <button
          onClick={tailor}
          disabled={loading}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
        >
          {loading ? 'Tailoring…' : version ? 'Re-tailor' : 'Tailor Resume'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {version?.pdf_url && (
        <a
          href={version.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs font-medium text-blue-400 underline underline-offset-2 hover:text-blue-300"
        >
          Open tailored PDF ↗
        </a>
      )}
    </div>
  )
}
