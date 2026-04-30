'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface JobResult {
  id: string
  title: string
  company: string
  location: string | null
}

interface AppResult {
  id: string
  title: string
  company: string
  status: string
}

const STATUS_LABELS: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  technical: 'Technical',
  final: 'Final Round',
  offer: 'Offer',
  rejected: 'Rejected',
}

const PAGES = [
  { href: '/dashboard', label: 'Home', icon: '⌂' },
  { href: '/feed', label: 'Job Feed', icon: '◈' },
  { href: '/tracker', label: 'Tracker', icon: '⊟' },
  { href: '/analytics', label: 'Analytics', icon: '↗' },
  { href: '/prep', label: 'Interview Prep', icon: '◎' },
  { href: '/dsa', label: 'DSA Tracker', icon: '</>' },
  { href: '/profile', label: 'Profile', icon: '◯' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [jobs, setJobs] = useState<JobResult[]>([])
  const [apps, setApps] = useState<AppResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setJobs([])
      setApps([])
      return
    }
    setLoading(true)
    try {
      const [jobRes, appRes] = await Promise.all([
        fetch(`/api/jobs?search=${encodeURIComponent(q)}&limit=5`),
        fetch(`/api/applications?search=${encodeURIComponent(q)}&limit=5`),
      ])
      if (jobRes.ok) {
        const d = await jobRes.json() as { jobs: JobResult[] }
        setJobs(d.jobs ?? [])
      }
      if (appRes.ok) {
        const d = await appRes.json() as { applications: AppResult[] }
        setApps(d.applications ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void search(query), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setJobs([])
      setApps([])
    }
  }, [open])

  function navigate(href: string) {
    router.push(href)
    onOpenChange(false)
  }

  const filteredPages = query
    ? PAGES.filter(
        (p) =>
          p.label.toLowerCase().includes(query.toLowerCase()) ||
          p.href.includes(query.toLowerCase())
      )
    : PAGES

  const hasResults =
    filteredPages.length > 0 || jobs.length > 0 || apps.length > 0

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Palette */}
          <motion.div
            key="palette"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="fixed left-1/2 top-[18vh] z-[1001] w-full max-w-[540px] -translate-x-1/2"
          >
            <Command
              className="overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900 shadow-2xl shadow-black/60"
              shouldFilter={false}
              loop
            >
              {/* Input */}
              <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4">
                <svg className="h-4 w-4 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search pages, jobs, applications…"
                  className="flex-1 bg-transparent py-3.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                  autoFocus
                />
                {loading && (
                  <svg className="animate-spin h-3.5 w-3.5 shrink-0 text-zinc-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  Esc
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-[400px] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-zinc-500">
                  {loading ? 'Searching…' : 'No results found.'}
                </Command.Empty>

                {filteredPages.length > 0 && (
                  <Command.Group
                    heading="Pages"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-600"
                  >
                    {filteredPages.map((page) => (
                      <Command.Item
                        key={page.href}
                        value={page.href}
                        onSelect={() => navigate(page.href)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 cursor-pointer select-none aria-selected:bg-zinc-800 aria-selected:text-zinc-100 transition-colors"
                      >
                        <span className="text-base leading-none w-4 text-center text-zinc-500">
                          {page.icon}
                        </span>
                        {page.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {jobs.length > 0 && (
                  <Command.Group
                    heading="Jobs"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-600"
                  >
                    {jobs.map((job) => (
                      <Command.Item
                        key={job.id}
                        value={`job-${job.id}`}
                        onSelect={() => navigate(`/feed?job=${job.id}`)}
                        className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer select-none aria-selected:bg-zinc-800 transition-colors"
                      >
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-100 truncate">{job.title}</p>
                          <p className="text-xs text-zinc-500 truncate">
                            {job.company}
                            {job.location ? ` · ${job.location}` : ''}
                          </p>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {apps.length > 0 && (
                  <Command.Group
                    heading="Applications"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-600"
                  >
                    {apps.map((app) => (
                      <Command.Item
                        key={app.id}
                        value={`app-${app.id}`}
                        onSelect={() => navigate(`/tracker`)}
                        className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer select-none aria-selected:bg-zinc-800 transition-colors"
                      >
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-100 truncate">{app.title}</p>
                          <p className="text-xs text-zinc-500 truncate">
                            {app.company}
                            {' · '}
                            <span className="text-zinc-600">
                              {STATUS_LABELS[app.status] ?? app.status}
                            </span>
                          </p>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {!hasResults && !loading && !query && (
                  <div className="px-3 py-2">
                    {PAGES.map((page) => (
                      <Command.Item
                        key={page.href}
                        value={page.href}
                        onSelect={() => navigate(page.href)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 cursor-pointer select-none aria-selected:bg-zinc-800 aria-selected:text-zinc-100 transition-colors"
                      >
                        <span className="text-base leading-none w-4 text-center text-zinc-500">
                          {page.icon}
                        </span>
                        {page.label}
                      </Command.Item>
                    ))}
                  </div>
                )}
              </Command.List>

              {/* Footer */}
              <div className="border-t border-zinc-800 px-4 py-2 flex items-center gap-4 text-[11px] text-zinc-600">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-zinc-700 px-1 py-0.5">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-zinc-700 px-1 py-0.5">↵</kbd>
                  select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-zinc-700 px-1 py-0.5">Esc</kbd>
                  close
                </span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
