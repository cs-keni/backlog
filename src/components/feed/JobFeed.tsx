'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Job, FeedFilters, SortOption } from '@/lib/jobs/types'
import { JobCard } from './JobCard'
import { JobDetail } from './JobDetail'
import { FeedHeader } from './FeedHeader'
import { FilterSidebar } from './FilterSidebar'
import { FeedSkeleton } from './JobSkeleton'

interface Cursor {
  cursor: string
  cursorId: string
}

const DEFAULT_FILTERS: FeedFilters = {
  location: '',
  isRemote: 'all',
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

export function JobFeed() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortOption>('newest')
  const [newJobCount, setNewJobCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  // Debounce filters to avoid firing on every keystroke
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingFilters = useRef<FeedFilters>(filters)

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
      setJobs(data.jobs)
      setNextCursor(data.nextCursor)
      setSelectedJobId(null)
    } catch {
      setError('Could not load jobs. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
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

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function handleRefreshNewJobs() {
    void fetchJobs(filters, sort)
  }

  function handleJobAdded(jobId: string) {
    // Refresh to surface the manually-added job at top
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
        <FilterSidebar filters={filters} onChange={setFilters} />
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
              <div className="text-center py-16 space-y-2">
                <p className="text-sm text-zinc-500">No jobs match your filters.</p>
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="text-xs text-zinc-600 hover:text-zinc-400 underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                {jobs.map((job, i) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    index={i}
                    isSelected={job.id === selectedJobId}
                    onClick={() =>
                      setSelectedJobId((prev) => (prev === job.id ? null : job.id))
                    }
                  />
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
      <div className={`hidden lg:block transition-all duration-300 ${selectedJobId ? 'w-[480px]' : 'w-0'} shrink-0 overflow-hidden border-l border-zinc-800`}>
        <div className="w-[480px] h-full overflow-hidden">
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
