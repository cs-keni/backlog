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

function timeAgo(iso: string | null): { label: string; isNew: boolean } {
  if (!iso) return { label: 'Unknown', isNew: false }
  const date = new Date(iso)
  if (isNaN(date.getTime())) return { label: 'Unknown', isNew: false }
  const diff = Date.now() - date.getTime()
  const hours = diff / 1000 / 60 / 60
  if (hours < 3) return { label: `${Math.ceil(hours)}h ago`, isNew: true }
  if (hours < 24) return { label: `${Math.floor(hours)}h ago`, isNew: false }
  const days = Math.floor(hours / 24)
  if (days === 1) return { label: '1d ago', isNew: false }
  if (days < 14) return { label: `${days}d ago`, isNew: false }
  if (days < 60) return { label: `${Math.floor(days / 7)}w ago`, isNew: false }
  return { label: `${Math.floor(days / 30)}mo ago`, isNew: false }
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

// Deterministic color from company name — picks from a fixed palette
const AVATAR_COLORS = [
  'bg-blue-500/20 text-blue-300',
  'bg-violet-500/20 text-violet-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-orange-500/20 text-orange-300',
  'bg-pink-500/20 text-pink-300',
  'bg-cyan-500/20 text-cyan-300',
  'bg-yellow-500/20 text-yellow-300',
  'bg-rose-500/20 text-rose-300',
]

function companyAvatar(name: string): { initials: string; color: string } {
  const words = name.trim().split(/\s+/)
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return { initials, color: AVATAR_COLORS[hash % AVATAR_COLORS.length] }
}

export function JobCard({ job, isSelected, onClick, index }: JobCardProps) {
  const salary = formatSalary(job.salary_min, job.salary_max)
  const { label: timeLabel, isNew } = timeAgo(job.posted_at)
  const application = job.applications?.[0]
  const avatar = companyAvatar(job.company)

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
      <div className="flex items-start gap-3 mb-1.5">
        {/* Company avatar */}
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-semibold ${avatar.color}`}>
          {avatar.initials}
        </div>
        <div className="min-w-0 flex-1">
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
