'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import type { ApplicationWithJob } from '@/lib/jobs/types'

interface ApplicationCardProps {
  app: ApplicationWithJob
  index: number
  isSelected: boolean
  isDragOverlay?: boolean
  onClick: () => void
}

function appAge(app: ApplicationWithJob): { label: string; nudge: string | null } {
  const ref = app.applied_at ?? app.last_updated
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)

  let label: string
  if (days === 0) label = 'Today'
  else if (days === 1) label = '1 day ago'
  else label = `${days} days ago`

  let nudge: string | null = null
  if (app.status === 'saved' && days >= 14) nudge = 'Apply soon'
  else if (app.status === 'applied' && days >= 7) nudge = 'Follow up?'

  return { label, nudge }
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max!)}`
}

// Shared logo/avatar helpers (mirrors JobCard)
const ATS_PATTERNS: Array<{ domain: string; slugIndex: number }> = [
  { domain: 'greenhouse.io', slugIndex: 1 },
  { domain: 'lever.co', slugIndex: 1 },
  { domain: 'ashbyhq.com', slugIndex: 1 },
  { domain: 'workable.com', slugIndex: 1 },
]
const BLOCKED_DOMAINS = ['taleo.net', 'icims.com', 'jobvite.com', 'smartrecruiters.com', 'successfactors.com', 'bamboohr.com']
const WORKDAY_PATTERNS = ['myworkdayjobs.com', 'workday.com']
const AVATAR_COLORS = [
  'bg-blue-500/20 text-blue-300', 'bg-violet-500/20 text-violet-300',
  'bg-emerald-500/20 text-emerald-300', 'bg-orange-500/20 text-orange-300',
  'bg-pink-500/20 text-pink-300', 'bg-cyan-500/20 text-cyan-300',
  'bg-yellow-500/20 text-yellow-300', 'bg-rose-500/20 text-rose-300',
]

function getDomain(company: string, jobUrl: string | null): string {
  if (!jobUrl) return `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
  try {
    const u = new URL(jobUrl)
    const hostname = u.hostname
    for (const ats of ATS_PATTERNS) {
      if (hostname.includes(ats.domain)) {
        const parts = u.pathname.split('/').filter(Boolean)
        const slug = parts[ats.slugIndex - 1]
        if (slug) return `${slug}.com`
      }
    }
    for (const wd of WORKDAY_PATTERNS) {
      if (hostname.includes(wd)) {
        const subdomain = hostname.split('.')[0]
        if (subdomain) return `${subdomain}.com`
      }
    }
    if (BLOCKED_DOMAINS.some((d) => hostname.includes(d))) {
      return `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
    }
    return hostname.replace(/^www\./, '')
  } catch {
    return `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
  }
}

function companyAvatar(name: string): { initials: string; color: string } {
  const words = name.trim().split(/\s+/)
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return { initials, color: AVATAR_COLORS[hash % AVATAR_COLORS.length] }
}

export function ApplicationCard({ app, index, isSelected, isDragOverlay = false, onClick }: ApplicationCardProps) {
  const domain = getDomain(app.jobs.company, app.jobs.url)
  const logoUrls = [
    `https://logo.clearbit.com/${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ]
  const [logoSourceIndex, setLogoSourceIndex] = useState(0)
  const logoFailed = logoSourceIndex >= logoUrls.length
  const avatar = companyAvatar(app.jobs.company)
  const salary = formatSalary(app.jobs.salary_min, app.jobs.salary_max)
  const { label: ageLabel, nudge } = appAge(app)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: app.id,
    disabled: isDragOverlay,
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={isDragOverlay ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0 : 1, y: 0 }}
      transition={{ duration: 0.18, delay: isDragOverlay ? 0 : Math.min(index * 0.04, 0.25) }}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Don't open detail if this was a drag
        if (!isDragging) {
          e.stopPropagation()
          onClick()
        }
      }}
      className={`
        rounded-xl border px-3 py-3 cursor-grab active:cursor-grabbing transition-colors select-none
        ${isDragOverlay
          ? 'border-zinc-600 bg-zinc-800 shadow-2xl rotate-1 scale-105'
          : isSelected
            ? 'border-zinc-600 bg-zinc-800'
            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
        }
      `}
    >
      {/* Logo + title */}
      <div className="flex items-start gap-2.5 mb-2">
        {!logoFailed ? (
          <img
            src={logoUrls[logoSourceIndex]}
            alt={app.jobs.company}
            onError={() => setLogoSourceIndex((i) => i + 1)}
            className="shrink-0 w-7 h-7 rounded-md object-contain bg-white p-[2px]"
          />
        ) : (
          <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold ${avatar.color}`}>
            {avatar.initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-zinc-100 truncate leading-snug">{app.jobs.title}</p>
          <p className="text-[11px] text-zinc-400 truncate">{app.jobs.company}</p>
        </div>
      </div>

      {/* Salary */}
      {salary && (
        <p className="text-[11px] text-zinc-500 mb-1.5">{salary}</p>
      )}

      {/* Age + nudge */}
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <span className="text-[11px] text-zinc-600">{ageLabel}</span>
        {nudge && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
            {nudge}
          </span>
        )}
      </div>
    </motion.div>
  )
}
