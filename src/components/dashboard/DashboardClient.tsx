'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardJob {
  id: string
  title: string
  company: string
  location: string | null
  salary_min: number | null
  salary_max: number | null
  tags: string[] | null
  is_remote: boolean
  posted_at: string | null
  fetched_at: string
  url: string
}

interface PipelineEntry { status: string; count: number }
interface SparklineEntry { date: string; count: number }

interface PrepNudge {
  id: string
  jobTitle: string
  company: string
  status: string
  lastUpdated: string
}

interface DashboardClientProps {
  stats: { openApplications: number; interviews: number; offers: number; jobsToday: number }
  newestJobs: DashboardJob[]
  pipeline: PipelineEntry[]
  sparkline: SparklineEntry[]
  prepNudges: PrepNudge[]
  userName: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  phone_screen: 'Phone screen',
  technical: 'Technical',
  final: 'Final round',
  offer: 'Offer',
  rejected: 'Rejected',
}

const STATUS_COLORS: Record<string, string> = {
  saved: '#52525b',
  applied: '#6366f1',
  phone_screen: '#8b5cf6',
  technical: '#a78bfa',
  final: '#f59e0b',
  offer: '#10b981',
  rejected: '#ef4444',
}

const STATUS_BADGE: Record<string, string> = {
  phone_screen: 'bg-purple-500/15 text-purple-400',
  technical: 'bg-violet-500/15 text-violet-400',
  final: 'bg-amber-500/15 text-amber-400',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSalary(min: number | null, max: number | null): string | null {
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
  if (min && max) return `${fmt(min)}–${fmt(max)}`
  if (min) return `${fmt(min)}+`
  if (max) return `up to ${fmt(max)}`
  return null
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = diff / 1000 / 60 / 60
  if (h < 1) return `${Math.ceil(h * 60)}m ago`
  if (h < 24) return `${Math.floor(h)}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? '1d ago' : `${d}d ago`
}

function isJustPosted(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < 3 * 60 * 60 * 1000
}

// ATS logo extraction — matches JobCard.tsx logic
const ATS_PATTERNS = [
  { domain: 'greenhouse.io', slugIndex: 1 },
  { domain: 'lever.co', slugIndex: 1 },
  { domain: 'ashbyhq.com', slugIndex: 1 },
]
const BLOCKED_DOMAINS = ['taleo.net', 'icims.com', 'jobvite.com', 'smartrecruiters.com', 'bamboohr.com']

function getLogoDomain(company: string, jobUrl: string): string {
  try {
    const u = new URL(jobUrl)
    const h = u.hostname
    for (const ats of ATS_PATTERNS) {
      if (h.includes(ats.domain)) {
        const slug = u.pathname.split('/').filter(Boolean)[ats.slugIndex - 1]
        if (slug) return `${slug}.com`
      }
    }
    if (h.includes('myworkdayjobs.com')) return `${h.split('.')[0]}.com`
    if (BLOCKED_DOMAINS.some(d => h.includes(d))) return `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
    return h.replace(/^www\./, '')
  } catch {
    return `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
  }
}

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <motion.div variants={itemVariants} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 space-y-1">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-semibold text-zinc-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </motion.div>
  )
}

function CompanyLogo({ company, url }: { company: string; url: string }) {
  const domain = getLogoDomain(company, url)
  const [imgUrl, setImgUrl] = useState(`https://logo.clearbit.com/${domain}`)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="h-8 w-8 rounded-md bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-400 shrink-0">
        {company[0]?.toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={imgUrl}
      alt={company}
      className="h-8 w-8 rounded-md object-contain bg-white/5 shrink-0"
      onError={() => {
        if (imgUrl.includes('clearbit')) {
          setImgUrl(`https://icons.duckduckgo.com/ip3/${domain}.ico`)
        } else {
          setFailed(true)
        }
      }}
    />
  )
}

function NewestJobs({ jobs }: { jobs: DashboardJob[] }) {
  return (
    <motion.div variants={itemVariants} className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
        <h2 className="text-sm font-semibold text-zinc-200">Newest jobs</h2>
        <Link href="/feed" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          View all →
        </Link>
      </div>
      <div className="divide-y divide-zinc-800/60">
        {jobs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-600 text-center">No jobs yet</p>
        ) : (
          jobs.map(job => {
            const salary = formatSalary(job.salary_min, job.salary_max)
            const justPosted = isJustPosted(job.fetched_at)
            return (
              <Link key={job.id} href={`/feed?job=${job.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors group">
                <CompanyLogo company={job.company} url={job.url} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                      {job.title}
                    </span>
                    {justPosted && (
                      <span className="shrink-0 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">
                        Just posted
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                    <span>{job.company}</span>
                    <span>·</span>
                    <span>{job.is_remote ? 'Remote' : (job.location ?? 'Location unknown')}</span>
                    {salary && <><span>·</span><span>{salary}</span></>}
                  </div>
                  {job.tags && job.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {job.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-zinc-600 shrink-0 pt-0.5">
                  {timeAgo(job.fetched_at)}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </motion.div>
  )
}

function PrepNudges({ nudges }: { nudges: PrepNudge[] }) {
  if (nudges.length === 0) return null
  return (
    <motion.div variants={itemVariants} className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
        <h2 className="text-sm font-semibold text-zinc-200">Active interviews</h2>
        <Link href="/tracker" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          Open tracker →
        </Link>
      </div>
      <div className="divide-y divide-zinc-800/60">
        {nudges.map(nudge => (
          <Link key={nudge.id} href={`/prep?job_id=${nudge.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{nudge.jobTitle}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{nudge.company}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[nudge.status] ?? 'bg-zinc-700 text-zinc-400'}`}>
                {STATUS_LABELS[nudge.status] ?? nudge.status}
              </span>
              <span className="text-[11px] text-zinc-600">{timeAgo(nudge.lastUpdated)}</span>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

function PipelineSummary({ pipeline }: { pipeline: PipelineEntry[] }) {
  const max = Math.max(...pipeline.map(p => p.count), 1)
  return (
    <motion.div variants={itemVariants} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-zinc-200">Pipeline</h2>
      <div className="space-y-2">
        {pipeline.map(({ status, count }) => (
          <div key={status} className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-24 shrink-0">{STATUS_LABELS[status]}</span>
            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(count / max) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
                className="h-full rounded-full"
                style={{ backgroundColor: STATUS_COLORS[status] ?? '#52525b' }}
              />
            </div>
            <span className="text-xs text-zinc-400 tabular-nums w-5 text-right shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function SparklineTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  const d = label ? new Date(label + 'T00:00:00') : null
  const formatted = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : label
  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 shadow-lg">
      <p className="text-[11px] text-zinc-400">{formatted}</p>
      <p className="text-xs font-semibold text-zinc-200">{payload[0]?.value ?? 0} applied</p>
    </div>
  )
}

function ActivitySparkline({ data }: { data: SparklineEntry[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <motion.div variants={itemVariants} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Applications (30d)</h2>
        <span className="text-xs text-zinc-500 tabular-nums">{total} total</span>
      </div>
      {total === 0 ? (
        <p className="text-xs text-zinc-600 py-4 text-center">No applications yet</p>
      ) : (
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="20%">
              <Tooltip content={<SparklineTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardClient({ stats, newestJobs, pipeline, sparkline, prepNudges, userName }: DashboardClientProps) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = userName?.split(' ')[0] ?? null
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-xl font-semibold text-zinc-100">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">{today}</p>
      </motion.div>

      {/* Stats strip */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <StatCard label="Open" value={stats.openApplications} sub="applications" />
        <StatCard label="Interviewing" value={stats.interviews} sub="active rounds" />
        <StatCard label="Offers" value={stats.offers} />
        <StatCard label="New today" value={stats.jobsToday} sub="jobs in feed" />
      </motion.div>

      {/* 2-column grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Left column */}
        <div className="space-y-5">
          <NewestJobs jobs={newestJobs} />
          <PrepNudges nudges={prepNudges} />
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <PipelineSummary pipeline={pipeline} />
          <ActivitySparkline data={sparkline} />
        </div>
      </motion.div>
    </div>
  )
}
