'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { MaterialsSection } from './MaterialsSection'
import { QuestionBank } from './QuestionBank'
import { StarResponseSection } from './StarResponseSection'
import { CompanyIntelligence } from './CompanyIntelligence'
import { StoryBank } from './StoryBank'
import type { StarResponse, CompanyProfile } from '@/lib/jobs/types'

interface JobSummary {
  id: string
  title: string
  company: string
  company_id: string | null
  company_profiles: CompanyProfile | null
}

interface ApplicationSummary {
  id: string
  status: string
  jobs: {
    id: string
    title: string
    company: string
  }
}

// ─── No job selected — show application picker ────────────────────────────────

function ApplicationPicker() {
  const [apps, setApps] = useState<ApplicationSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/applications')
      .then(r => r.json())
      .then((data: ApplicationSummary[]) => {
        const active = data.filter(a =>
          ['saved', 'applied', 'phone_screen', 'technical', 'final'].includes(a.status)
        )
        setApps(active)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const statusLabel: Record<string, string> = {
    saved: 'Saved',
    applied: 'Applied',
    phone_screen: 'Phone Screen',
    technical: 'Technical',
    final: 'Final Round',
  }

  if (loading) {
    return (
      <div className="space-y-2 p-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-lg bg-zinc-800/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (apps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-sm text-zinc-400">No active applications to prep for.</p>
          <Link href="/feed" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Browse jobs →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4 max-w-xl">
      <div>
        <h1 className="text-base font-semibold text-zinc-100">Interview Prep</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Select a role to prep for.</p>
      </div>
      <div className="space-y-2">
        {apps.map((app, i) => (
          <motion.div
            key={app.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              href={`/prep?job_id=${app.jobs.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-700 hover:bg-zinc-900 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 transition-colors">
                  {app.jobs.title}
                </p>
                <p className="text-xs text-zinc-500">{app.jobs.company}</p>
              </div>
              <span className="text-xs text-zinc-600 shrink-0">
                {statusLabel[app.status] ?? app.status}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Full prep view ────────────────────────────────────────────────────────────

interface PrepViewProps {
  jobId: string
}

function PrepView({ jobId }: PrepViewProps) {
  const [job, setJob] = useState<JobSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [starResponses, setStarResponses] = useState<StarResponse[]>([])
  const [enriching, setEnriching] = useState(false)
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then(r => r.json())
      .then((data: JobSummary) => {
        setJob(data)
        setCompanyProfile(data.company_profiles)

        if (data.company_id && !data.company_profiles?.enriched_at) {
          setEnriching(true)
          fetch(`/api/company/${data.company_id}/enrich`, { method: 'POST' })
            .then(r => r.ok ? r.json() : null)
            .then((enriched: CompanyProfile | null) => {
              if (enriched) setCompanyProfile(enriched)
            })
            .catch(() => {})
            .finally(() => setEnriching(false))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [jobId])

  useEffect(() => {
    if (!job?.company_id) return
    fetch(`/api/star-responses?company_id=${job.company_id}`)
      .then(r => r.json())
      .then((data: StarResponse[]) => setStarResponses(data))
      .catch(() => {})
  }, [job?.company_id])

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-2xl">
        <div className="h-10 w-64 bg-zinc-800/50 rounded-lg animate-pulse" />
        <div className="h-32 bg-zinc-800/50 rounded-lg animate-pulse" />
        <div className="h-48 bg-zinc-800/50 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">Job not found.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/prep"
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors inline-flex items-center gap-1"
        >
          ← All applications
        </Link>
        <h1 className="text-base font-semibold text-zinc-100">{job.title}</h1>
        <p className="text-sm text-zinc-500">{job.company}</p>
      </div>

      {/* Company intelligence */}
      {companyProfile && (
        <CompanyIntelligence company={companyProfile} enriching={enriching} />
      )}

      {/* Materials */}
      <MaterialsSection jobId={jobId} />

      {/* Question bank — rich guide with story bank cross-reference */}
      {job.company_id ? (
        <QuestionBank
          companyId={job.company_id}
          companyName={job.company}
          savedResponses={starResponses}
          onResponseSaved={response => {
            setStarResponses(prev => {
              const idx = prev.findIndex(r => r.id === response.id)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = response
                return next
              }
              return [response, ...prev]
            })
          }}
        />
      ) : (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Interview Questions</h2>
          <p className="text-xs text-zinc-600">No company profile linked to this job.</p>
        </section>
      )}

      {/* Saved STAR responses */}
      <StarResponseSection
        responses={starResponses}
        onDeleted={id => setStarResponses(prev => prev.filter(r => r.id !== id))}
        onUpdated={updated => setStarResponses(prev =>
          prev.map(r => r.id === updated.id ? updated : r)
        )}
      />
    </div>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────

type PrepTab = 'prep' | 'stories'

export function PrepClient({ jobId }: { jobId: string | null }) {
  const [tab, setTab] = useState<PrepTab>('prep')

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 pt-4 border-b border-zinc-800 shrink-0">
        {([
          { id: 'prep' as const, label: jobId ? 'Prep' : 'Interview Prep' },
          { id: 'stories' as const, label: 'Story Bank' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'text-zinc-100 border-zinc-300'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'prep' ? (
          jobId ? <PrepView jobId={jobId} /> : <ApplicationPicker />
        ) : (
          <div className="p-6 max-w-2xl">
            <StoryBank />
          </div>
        )}
      </div>
    </div>
  )
}
