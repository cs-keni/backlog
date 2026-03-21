'use client'

import { motion } from 'framer-motion'
import { Job } from '@/lib/jobs/types'

interface JobCardProps {
  job: Job
  isSelected: boolean
  onClick: () => void
  index: number
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) =>
    n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max!)}`
}

function timeAgo(iso: string): { label: string; isNew: boolean } {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = diff / 1000 / 60 / 60
  if (hours < 3) return { label: `${Math.ceil(hours)}h ago`, isNew: true }
  if (hours < 24) return { label: `${Math.floor(hours)}h ago`, isNew: false }
  const days = Math.floor(hours / 24)
  if (days === 1) return { label: '1d ago', isNew: false }
  if (days < 7) return { label: `${days}d ago`, isNew: false }
  return { label: `${Math.floor(days / 7)}w ago`, isNew: false }
}

const statusColors: Record<string, string> = {
  saved: 'bg-zinc-700 text-zinc-300',
  applied: 'bg-blue-500/20 text-blue-400',
  phone_screen: 'bg-yellow-500/20 text-yellow-400',
  technical: 'bg-purple-500/20 text-purple-400',
  final: 'bg-orange-500/20 text-orange-400',
  offer: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
}

const statusLabels: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  technical: 'Technical',
  final: 'Final Round',
  offer: 'Offer',
  rejected: 'Rejected',
}

export function JobCard({ job, isSelected, onClick, index }: JobCardProps) {
  const salary = formatSalary(job.salary_min, job.salary_max)
  const { label: timeLabel, isNew } = timeAgo(job.posted_at)
  const application = job.applications?.[0]

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3), ease: 'easeOut' }}
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3.5 transition-colors cursor-pointer ${
        isSelected
          ? 'border-zinc-600 bg-zinc-800'
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/60'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">{job.title}</p>
          <p className="text-xs text-zinc-400 truncate mt-0.5">{job.company}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {isNew && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              New
            </span>
          )}
          {application && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[application.status] ?? 'bg-zinc-700 text-zinc-300'}`}
            >
              {statusLabels[application.status] ?? application.status}
            </span>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {job.location && (
          <span className="text-xs text-zinc-500">{job.location}</span>
        )}
        {job.is_remote && !job.location?.toLowerCase().includes('remote') && (
          <span className="text-xs text-zinc-500">Remote</span>
        )}
        {salary && (
          <>
            {job.location && <span className="text-zinc-700">·</span>}
            <span className="text-xs text-zinc-500">{salary}</span>
          </>
        )}
        <span className="text-zinc-700 ml-auto text-xs">{timeLabel}</span>
      </div>

      {/* Tags */}
      {job.tags && job.tags.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {job.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.button>
  )
}
