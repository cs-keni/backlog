'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ApplicationWithJob, ApplicationStatus } from '@/lib/jobs/types'

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  saved:        'bg-zinc-700/60 text-zinc-300 border-zinc-600',
  applied:      'bg-blue-500/15 text-blue-400 border-blue-500/25',
  phone_screen: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  technical:    'bg-purple-500/15 text-purple-400 border-purple-500/25',
  final:        'bg-orange-500/15 text-orange-400 border-orange-500/25',
  offer:        'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  rejected:     'bg-red-500/15 text-red-400 border-red-500/25',
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved', applied: 'Applied', phone_screen: 'Phone Screen',
  technical: 'Technical', final: 'Final Round', offer: 'Offer', rejected: 'Rejected',
}

// Shared logo helpers (mirrors JobCard/ApplicationCard)
const ATS_PATTERNS = [
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

function getDomain(company: string, jobUrl: string): string {
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
    if (BLOCKED_DOMAINS.some((d) => hostname.includes(d)))
      return `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
    return hostname.replace(/^www\./, '')
  } catch {
    return `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
  }
}

function companyAvatar(name: string): { initials: string; color: string } {
  const words = name.trim().split(/\s+/)
  const initials = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return { initials, color: AVATAR_COLORS[hash % AVATAR_COLORS.length] }
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`
  if (min && max) return `${fmt(min)}–${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `≤${fmt(max!)}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type SortKey = 'company' | 'status' | 'applied_at' | 'last_updated' | 'salary'
type SortDir = 'asc' | 'desc'

interface ApplicationListProps {
  applications: ApplicationWithJob[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function LogoCell({ company, url }: { company: string; url: string }) {
  const domain = getDomain(company, url)
  const logoUrls = [
    `https://logo.clearbit.com/${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ]
  const [idx, setIdx] = useState(0)
  const failed = idx >= logoUrls.length
  const avatar = companyAvatar(company)

  if (failed) {
    return (
      <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-semibold shrink-0 ${avatar.color}`}>
        {avatar.initials}
      </div>
    )
  }
  return (
    <img
      src={logoUrls[idx]}
      alt={company}
      onError={() => setIdx(i => i + 1)}
      className="w-6 h-6 rounded object-contain bg-white p-[2px] shrink-0"
    />
  )
}

export function ApplicationList({ applications, selectedId, onSelect }: ApplicationListProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('last_updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return applications.filter(a =>
      !q ||
      a.jobs.company.toLowerCase().includes(q) ||
      a.jobs.title.toLowerCase().includes(q)
    )
  }, [applications, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number | null = null
      let bv: string | number | null = null

      if (sortKey === 'company') { av = a.jobs.company; bv = b.jobs.company }
      else if (sortKey === 'status') { av = a.status; bv = b.status }
      else if (sortKey === 'applied_at') { av = a.applied_at; bv = b.applied_at }
      else if (sortKey === 'last_updated') { av = a.last_updated; bv = b.last_updated }
      else if (sortKey === 'salary') { av = a.jobs.salary_min; bv = b.jobs.salary_min }

      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1

      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="opacity-0 group-hover:opacity-40 ml-1">↕</span>
    return <span className="ml-1 opacity-70">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-zinc-800 shrink-0">
        <input
          type="text"
          placeholder="Search company or role…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-zinc-950 z-10">
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide w-8" />
              <th
                className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide cursor-pointer group select-none"
                onClick={() => toggleSort('company')}
              >
                Company <SortIcon col="company" />
              </th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                Role
              </th>
              <th
                className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide cursor-pointer group select-none"
                onClick={() => toggleSort('status')}
              >
                Status <SortIcon col="status" />
              </th>
              <th
                className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide cursor-pointer group select-none hidden md:table-cell"
                onClick={() => toggleSort('applied_at')}
              >
                Applied <SortIcon col="applied_at" />
              </th>
              <th
                className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide cursor-pointer group select-none hidden lg:table-cell"
                onClick={() => toggleSort('salary')}
              >
                Salary <SortIcon col="salary" />
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {sorted.map((app, i) => (
                <motion.tr
                  key={app.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, delay: Math.min(i * 0.02, 0.15) }}
                  onClick={() => onSelect(app.id)}
                  className={`border-b border-zinc-800/60 cursor-pointer transition-colors ${
                    selectedId === app.id
                      ? 'bg-zinc-800'
                      : app.is_archived
                        ? 'opacity-50 hover:bg-zinc-900/40'
                        : 'hover:bg-zinc-900/60'
                  }`}
                >
                  <td className="px-4 py-3">
                    <LogoCell company={app.jobs.company} url={app.jobs.url} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-zinc-200 font-medium text-[13px] truncate max-w-[160px]">{app.jobs.company}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-zinc-400 text-[13px] truncate max-w-[220px]">{app.jobs.title}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[app.status]}`}>
                      {STATUS_LABELS[app.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-[12px] text-zinc-500">{formatDate(app.applied_at ?? app.last_updated)}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-[12px] text-zinc-500">{formatSalary(app.jobs.salary_min, app.jobs.salary_max) ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-zinc-600 group-hover:text-zinc-400">→</span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-16 text-zinc-600 text-sm">
            {search ? 'No matches found' : 'No applications'}
          </div>
        )}
      </div>
    </div>
  )
}
