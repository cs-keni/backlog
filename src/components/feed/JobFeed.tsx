'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Job, FeedFilters, SortOption } from '@/lib/jobs/types'
import { JobCard } from './JobCard'
import { JobDetail } from './JobDetail'
import { FeedHeader } from './FeedHeader'
import { FilterSidebar } from './FilterSidebar'
import { FeedSkeleton } from './JobSkeleton'
import { useToast } from '@/components/ui/Toaster'
import { EmptyState } from '@/components/ui/EmptyState'

interface Cursor {
  cursor: string
  cursorId: string
}

const DEFAULT_FILTERS: FeedFilters = {
  location: '',
  isRemote: 'all',
  country: 'all',
  salaryMin: '',
  experienceLevel: '',
  roleType: '',
  dateRange: '',
}

function buildParams(
  filters: FeedFilters,
  sort: SortOption,
  cursor?: Cursor
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('sort', sort)
  if (filters.location) params.set('location', filters.location)
  if (filters.isRemote === 'remote') params.set('is_remote', 'true')
  if (filters.isRemote === 'onsite') params.set('is_remote', 'false')
  if (filters.country !== 'all') params.set('country', filters.country)
  if (filters.salaryMin) params.set('salary_min', filters.salaryMin)
  if (filters.experienceLevel) params.set('experience_level', filters.experienceLevel)
  if (filters.roleType) params.set('role_type', filters.roleType)
  if (filters.dateRange) params.set('date_range', filters.dateRange)
  if (cursor) {
    params.set('cursor', cursor.cursor)
    params.set('cursorId', cursor.cursorId)
  }
  return params
}

interface JobFeedProps {
  initialJobId?: string
}

export function JobFeed({ initialJobId }: JobFeedProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId ?? null)
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortOption>('newest')
  const [newJobCount, setNewJobCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingFilters = useRef<FeedFilters>(filters)
  const filterFocusRef = useRef<(() => void) | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  // When a deep-linked job is selected on load, preserve that selection through the first fetch
  const preserveSelectionRef = useRef(!!initialJobId)
  // Stash the deep-linked job so it stays in the list even if it's not on the first feed page
  const deepLinkedJobRef = useRef<Job | null>(null)

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null

  // ─── Initial + filter/sort fetch ────────────────────────────────────────────

  const fetchJobs = useCallback(async (f: FeedFilters, s: SortOption) => {
    setLoading(true)
    setError(null)
    setNewJobCount(0)
    try {
      const res = await fetch(`/api/jobs?${buildParams(f, s)}`)
      if (!res.ok) throw new Error('Failed to fetch jobs')
      const data = await res.json() as { jobs: Job[]; nextCursor: Cursor | null }
      setJobs((prev) => {
        // Keep the deep-linked job pinned at top if it's not in this page of results
        const stashed = deepLinkedJobRef.current
        if (stashed && !data.jobs.some((j) => j.id === stashed.id)) {
          return [stashed, ...data.jobs]
        }
        return data.jobs
      })
      setNextCursor(data.nextCursor)
      // Don't clear selection on the first fetch if we came from a deep link
      if (!preserveSelectionRef.current) {
        setSelectedJobId(null)
      }
      preserveSelectionRef.current = false
    } catch {
      setError('Could not load jobs. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Deep-link job fetch (runs once on mount) ────────────────────────────────

  useEffect(() => {
    if (!initialJobId) return

    fetch(`/api/jobs/${initialJobId}`)
      .then((r) => (r.ok ? (r.json() as Promise<Job>) : null))
      .then((job) => {
        if (!job) return
        deepLinkedJobRef.current = job
        setJobs((prev) => (prev.some((j) => j.id === job.id) ? prev : [job, ...prev]))
        setSelectedJobId(initialJobId)
        router.replace('/feed', { scroll: false })
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Load more (infinite scroll) ────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/jobs?${buildParams(pendingFilters.current, sort, nextCursor)}`)
      if (!res.ok) return
      const data = await res.json() as { jobs: Job[]; nextCursor: Cursor | null }
      setJobs((prev) => {
        const ids = new Set(prev.map((j) => j.id))
        return [...prev, ...data.jobs.filter((j) => !ids.has(j.id))]
      })
      setNextCursor(data.nextCursor)
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, loadingMore, sort])

  // ─── Intersection observer for sentinel ─────────────────────────────────────

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loadingMore) {
          void loadMore()
        }
      },
      { rootMargin: '200px' }
    )
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current)
    }
    return () => observerRef.current?.disconnect()
  }, [nextCursor, loadingMore, loadMore])

  // ─── Supabase real-time subscription ────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('jobs-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jobs' },
        () => {
          setNewJobCount((n) => n + 1)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  // ─── Filter/sort changes ─────────────────────────────────────────────────────

  useEffect(() => {
    pendingFilters.current = filters
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current)
    filterDebounceRef.current = setTimeout(() => {
      void fetchJobs(filters, sort)
    }, 300)
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current)
    }
  }, [filters, sort, fetchJobs])

  // ─── Feed keyboard shortcuts (J/K navigate, A quick-apply, F focus filter) ──

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const isEditing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
        (e.target as HTMLElement)?.isContentEditable
      if (isEditing) return

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        setFocusedIndex((i) => {
          const next = Math.min(i + 1, jobs.length - 1)
          const job = jobs[next]
          if (job) {
            setSelectedJobId(job.id)
            cardRefs.current.get(job.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          }
          return next
        })
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        setFocusedIndex((i) => {
          const next = Math.max(i - 1, 0)
          const job = jobs[next]
          if (job) {
            setSelectedJobId(job.id)
            cardRefs.current.get(job.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          }
          return next
        })
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        filterFocusRef.current?.()
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        const job = focusedIndex >= 0 ? jobs[focusedIndex] : selectedJobId ? jobs.find((j) => j.id === selectedJobId) : null
        if (!job) return
        const existing = job.applications?.[0]
        if (existing && existing.status !== 'saved') return
        fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: job.id, status: 'applied' }),
        })
          .then((r) => {
            if (r.ok) {
              handleApplicationChange(job.id, 'applied')
              toast({ type: 'success', title: 'Marked as applied', description: `${job.title} at ${job.company}` })
            }
          })
          .catch(() => toast({ type: 'error', title: 'Could not reach server' }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, focusedIndex, selectedJobId, toast])

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function handleRefreshNewJobs() {
    void fetchJobs(filters, sort)
  }

  function handleJobAdded(jobId: string) {
    void fetchJobs(filters, sort).then(() => {
      setSelectedJobId(jobId)
    })
  }

  function handleApplicationChange(jobId: string, status: string, applicationId?: string) {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== jobId) return j
        const existing = j.applications ?? []
        const updated = applicationId
          ? existing.some((a) => a.id === applicationId)
            ? existing.map((a) => (a.id === applicationId ? { ...a, status } : a))
            : [...existing, { id: applicationId, status }]
          : existing.map((a) => ({ ...a, status }))
        return { ...j, applications: updated }
      })
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: filter sidebar */}
      <aside className="hidden md:block w-52 shrink-0 border-r border-zinc-800 overflow-y-auto p-4">
        <FilterSidebar filters={filters} onChange={setFilters} onFocusRef={filterFocusRef} />
      </aside>

      {/* Center: feed list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-3 max-w-2xl">
            <FeedHeader sort={sort} onSortChange={setSort} onJobAdded={handleJobAdded} />

            {/* New jobs banner */}
            <AnimatePresence>
              {newJobCount > 0 && (
                <motion.button
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onClick={handleRefreshNewJobs}
                  className="w-full py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  ↑ {newJobCount} new job{newJobCount > 1 ? 's' : ''} — click to refresh
                </motion.button>
              )}
            </AnimatePresence>

            {/* Feed content */}
            {loading ? (
              <FeedSkeleton />
            ) : error ? (
              <div className="text-center py-12 space-y-2">
                <p className="text-sm text-red-400">{error}</p>
                <button
                  onClick={() => fetchJobs(filters, sort)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                >
                  Try again
                </button>
              </div>
            ) : jobs.length === 0 ? (
              <EmptyState
                variant="search"
                title="No jobs match your filters"
                description="Try widening your search — remove a filter or expand the date range."
                secondaryAction={{ label: 'Clear filters', onClick: () => setFilters(DEFAULT_FILTERS) }}
                className="py-16"
              />
            ) : (
              <>
                {jobs.map((job, i) => (
                  <div
                    key={job.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(job.id, el)
                      else cardRefs.current.delete(job.id)
                    }}
                  >
                    <JobCard
                      job={job}
                      index={i}
                      isSelected={job.id === selectedJobId}
                      onClick={() => {
                        setSelectedJobId((prev) => (prev === job.id ? null : job.id))
                        setFocusedIndex(i)
                      }}
                      onQuickApply={(jobId) => handleApplicationChange(jobId, 'applied')}
                    />
                  </div>
                ))}

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-4" />

                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <svg className="animate-spin h-4 w-4 text-zinc-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                )}

                {!nextCursor && jobs.length > 0 && (
                  <p className="text-center text-xs text-zinc-700 py-4">
                    You&apos;ve seen all {jobs.length} jobs
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: job detail drawer */}
      <div className={`hidden lg:flex lg:flex-col transition-all duration-300 ${selectedJobId ? 'w-[480px]' : 'w-0'} shrink-0 overflow-hidden border-l border-zinc-800`}>
        <div className="w-[480px] flex-1 min-h-0 overflow-hidden">
          <JobDetail
            job={selectedJob}
            onClose={() => setSelectedJobId(null)}
            onApplicationChange={handleApplicationChange}
          />
        </div>
      </div>

      {/* Mobile: full-screen drawer */}
      <div className="lg:hidden">
        <JobDetail
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onApplicationChange={handleApplicationChange}
        />
      </div>
    </div>
  )
}
