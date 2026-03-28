'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Job } from '@/lib/jobs/types'
import { MatchScoreBadge } from './MatchScoreBadge'
import { CoverLetterSection } from './CoverLetterSection'

interface JobDetailProps {
  job: Job | null
  onClose: () => void
  onApplicationChange: (jobId: string, status: string, applicationId?: string) => void
}

function formatSalary(min: number | null, max: number | null): { annual: string; hourly: string } | null {
  if (!min && !max) return null
  const fmtAnnual = (n: number) => `$${n.toLocaleString()}`
  const fmtHourly = (n: number) => `$${Math.round(n / 2080)}/hr`

  if (min && max) return {
    annual: `${fmtAnnual(min)} – ${fmtAnnual(max)}`,
    hourly: `${fmtHourly(min)} – ${fmtHourly(max)}`,
  }
  if (min) return { annual: `${fmtAnnual(min)}+`, hourly: `${fmtHourly(min)}+` }
  return { annual: `Up to ${fmtAnnual(max!)}`, hourly: `Up to ${fmtHourly(max!)}` }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface ResumeVersion {
  id: string
  pdf_url: string
  created_at: string
}

interface EnrichedCompany {
  description: string | null
  headcount_range: string | null
  funding_stage: string | null
  tech_stack: string[] | null
  enriched_at: string | null
}

export function JobDetail({ job, onClose, onApplicationChange }: JobDetailProps) {
  const router = useRouter()
  const [actionState, setActionState] = useState<'idle' | 'loading'>('idle')
  const [tailorState, setTailorState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const tailoring = tailorState === 'loading'
  const [tailoredVersion, setTailoredVersion] = useState<ResumeVersion | null>(null)
  const [tailorError, setTailorError] = useState<string | null>(null)
  const [enrichedCompany, setEnrichedCompany] = useState<EnrichedCompany | null>(null)

  // Load existing tailored version when job changes
  useEffect(() => {
    if (!job) return
    setTailoredVersion(null)
    setTailorState('idle')
    setEnrichedCompany(null)
    fetch(`/api/resume/tailor?job_id=${job.id}`)
      .then(r => r.json())
      .then((data: ResumeVersion | null) => {
        if (data?.pdf_url) {
          setTailoredVersion(data)
          setTailorState('done')
        }
      })
      .catch(() => {})
  }, [job?.id])

  // Trigger lazy enrichment when company hasn't been enriched yet
  useEffect(() => {
    if (!job?.company_id) return
    if (job.company_profiles?.enriched_at) return
    fetch(`/api/company/${job.company_id}/enrich`, { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then((data: EnrichedCompany | null) => {
        if (data) setEnrichedCompany(data)
      })
      .catch(() => {})
  }, [job?.company_id, job?.company_profiles?.enriched_at])

  async function handleTailor() {
    if (!job || tailorState === 'loading') return
    setTailorState('loading')
    setTailorError(null)
    try {
      const res = await fetch('/api/resume/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id }),
      })
      if (res.ok) {
        const data = await res.json() as ResumeVersion
        setTailoredVersion(data)
        setTailorState('done')
      } else {
        const err = await res.json() as { error: string }
        setTailorError(err.error ?? 'Tailoring failed')
        setTailorState('error')
      }
    } catch {
      setTailorError('Something went wrong — please try again')
      setTailorState('error')
    }
  }

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

    // Only update status if not already applied or further along
    const alreadyApplied = application && application.status !== 'saved'
    if (alreadyApplied) return

    setActionState('loading')
    try {
      let res: Response
      if (application?.id) {
        // Existing saved application — promote to applied
        res = await fetch(`/api/applications/${application.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'applied' }),
        })
      } else {
        // No application yet — create one
        res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: job.id, status: 'applied' }),
        })
      }
      if (res.ok) {
        const data = await res.json() as { id: string; status: string }
        onApplicationChange(job.id, data.status, data.id)
        // Invalidate router cache so /tracker shows the new entry immediately
        router.refresh()
      }
    } finally {
      setActionState('idle')
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
            className="fixed top-0 right-0 h-full w-full max-w-xl bg-zinc-950 border-l border-zinc-800 z-30 flex flex-col overflow-hidden lg:relative lg:top-auto lg:right-auto lg:h-full lg:max-w-none lg:border-l lg:z-auto"
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
                {formatSalary(job.salary_min, job.salary_max) && (() => {
                  const sal = formatSalary(job.salary_min, job.salary_max)!
                  return (
                    <>
                      <Chip icon="💰">{sal.annual} / yr</Chip>
                      <Chip icon="⏱️">{sal.hourly}</Chip>
                    </>
                  )
                })()}
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

              {/* Match score */}
              <MatchScoreBadge jobId={job.id} />

              {/* Company panel */}
              {job.company_profiles && (() => {
                const cp = job.company_profiles
                const enriched = enrichedCompany
                const description = enriched?.description || cp.description
                const headcount = enriched?.headcount_range || cp.headcount_range
                const funding = enriched?.funding_stage || cp.funding_stage
                const techStack = enriched?.tech_stack || cp.tech_stack
                const glassdoorUrl = `https://www.glassdoor.com/Search/Results.htm?keyword=${encodeURIComponent(cp.name)}`

                return (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Company</h3>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-200">{cp.name}</p>
                        <a
                          href={glassdoorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
                        >
                          Glassdoor →
                        </a>
                      </div>
                      {description && (
                        <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {headcount && (
                          <span className="text-xs text-zinc-500">👥 {headcount}</span>
                        )}
                        {funding && funding !== 'Unknown' && (
                          <span className="text-xs text-zinc-500">💼 {funding}</span>
                        )}
                      </div>
                      {techStack && techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {techStack.map(t => (
                            <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

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

              {/* Tailor resume */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Resume</h3>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
                  {tailorState === 'done' && tailoredVersion ? (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-400">
                        Tailored resume ready{' '}
                        <span className="text-zinc-500">
                          · {new Date(tailoredVersion.created_at).toLocaleDateString()}
                        </span>
                      </p>
                      <div className="flex gap-2">
                        <a
                          href={tailoredVersion.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-center text-xs text-zinc-200 transition-colors"
                        >
                          Download PDF
                        </a>
                        <button
                          onClick={handleTailor}
                          disabled={tailoring}
                          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors disabled:opacity-50"
                        >
                          Re-tailor
                        </button>
                      </div>
                    </div>
                  ) : tailorState === 'loading' ? (
                    <div className="flex items-center gap-2 py-1">
                      <svg className="animate-spin h-3.5 w-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span className="text-xs text-zinc-500">Claude is tailoring your resume…</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-500">
                        Generate a version of your resume tailored to this job&apos;s requirements.
                      </p>
                      {tailorState === 'error' && tailorError && (
                        <p className="text-xs text-red-400">{tailorError}</p>
                      )}
                      <button
                        onClick={handleTailor}
                        className="w-full py-1.5 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
                      >
                        ✦ Tailor resume for this job
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cover Letter */}
              <CoverLetterSection jobId={job.id} />

              {/* Prep link */}
              <Link
                href={`/prep?job_id=${job.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-2.5 text-xs text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 transition-colors group"
              >
                <span>Prep for interview</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>

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
                <Link
                  href="/tracker"
                  className="flex-1 py-2 rounded-lg border border-zinc-800 text-center text-sm text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 transition-colors"
                >
                  {application.status.replace(/_/g, ' ')} — view in Tracker →
                </Link>
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
