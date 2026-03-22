'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Job } from '@/lib/jobs/types'

interface JobDetailProps {
  job: Job | null
  onClose: () => void
  onApplicationChange: (jobId: string, status: string, applicationId?: string) => void
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => `$${n.toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max!)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function JobDetail({ job, onClose, onApplicationChange }: JobDetailProps) {
  const [actionState, setActionState] = useState<'idle' | 'loading'>('idle')

  const application = job?.applications?.[0]

  async function handleSave() {
    if (!job || actionState === 'loading') return
    setActionState('loading')
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id, status: 'saved' }),
      })
      if (res.ok) {
        const data = await res.json() as { id: string; status: string }
        onApplicationChange(job.id, data.status, data.id)
      }
    } finally {
      setActionState('idle')
    }
  }

  async function handleApply() {
    if (!job) return
    // Open job URL in new tab; status change tracked by extension or manually
    window.open(job.url, '_blank', 'noopener,noreferrer')

    if (!application) {
      setActionState('loading')
      try {
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: job.id, status: 'applied' }),
        })
        if (res.ok) {
          const data = await res.json() as { id: string; status: string }
          onApplicationChange(job.id, data.status, data.id)
        }
      } finally {
        setActionState('idle')
      }
    }
  }

  return (
    <AnimatePresence>
      {job && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="fixed top-0 right-0 h-full w-full max-w-xl bg-zinc-950 border-l border-zinc-800 z-30 flex flex-col overflow-hidden lg:relative lg:top-auto lg:right-auto lg:h-auto lg:max-w-none lg:border-l lg:z-auto"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-zinc-800 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-zinc-100 leading-snug">{job.title}</h2>
                <p className="text-sm text-zinc-400 mt-0.5">{job.company}</p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Meta chips */}
              <div className="flex flex-wrap gap-2">
                {job.location && (
                  <Chip icon="📍">{job.location}</Chip>
                )}
                {job.is_remote && (
                  <Chip icon="🌐">Remote</Chip>
                )}
                {formatSalary(job.salary_min, job.salary_max) && (
                  <Chip icon="💰">{formatSalary(job.salary_min, job.salary_max)!}</Chip>
                )}
                {job.experience_level && (
                  <Chip icon="🎯">
                    {job.experience_level.charAt(0).toUpperCase() + job.experience_level.slice(1)}
                  </Chip>
                )}
                <Chip icon="📅">{formatDate(job.posted_at)}</Chip>
                {job.source === 'manual' && (
                  <Chip icon="✋">Manually added</Chip>
                )}
              </div>

              {/* Match score placeholder */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-xs text-zinc-500">
                  Upload your resume on the Profile page to see your match score for this role.
                </p>
              </div>

              {/* Company panel */}
              {job.company_profiles && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Company</h3>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 space-y-1.5">
                    <p className="text-sm font-medium text-zinc-200">{job.company_profiles.name}</p>
                    {job.company_profiles.description && (
                      <p className="text-xs text-zinc-500 leading-relaxed">{job.company_profiles.description}</p>
                    )}
                    <div className="flex gap-3 pt-1">
                      {job.company_profiles.headcount_range && (
                        <span className="text-xs text-zinc-500">
                          👥 {job.company_profiles.headcount_range}
                        </span>
                      )}
                      {job.company_profiles.funding_stage && (
                        <span className="text-xs text-zinc-500">
                          💼 {job.company_profiles.funding_stage}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              {job.tags && job.tags.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {job.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {job.description && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Job Description</h3>
                  <div className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
                    {job.description}
                  </div>
                </div>
              )}
            </div>

            {/* Action footer */}
            <div className="shrink-0 p-4 border-t border-zinc-800 flex gap-2">
              {!application || application.status === 'saved' ? (
                <>
                  {!application && (
                    <button
                      onClick={handleSave}
                      disabled={actionState === 'loading'}
                      className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors disabled:opacity-50"
                    >
                      Save
                    </button>
                  )}
                  <button
                    onClick={handleApply}
                    disabled={actionState === 'loading'}
                    className="flex-1 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors disabled:opacity-50"
                  >
                    Apply →
                  </button>
                </>
              ) : (
                <div className="flex-1 py-2 rounded-lg border border-zinc-800 text-center text-sm text-zinc-500">
                  {application.status.replace('_', ' ')} — view in Tracker
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function Chip({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-400">
      <span>{icon}</span>
      {children}
    </span>
  )
}
