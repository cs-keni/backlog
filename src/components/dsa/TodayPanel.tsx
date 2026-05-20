'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LcSolveWithReviews, LcReview } from '@/lib/dsa/types'
import type { NeetcodeProblem } from '@/lib/dsa/neetcode150'
import {
  getActiveCategory,
  getRecommendations,
  getCategoryProgress,
  DAILY_NEW_TARGET,
} from '@/lib/dsa/recommend'

interface ReviewItem {
  review: LcReview
  solve: LcSolveWithReviews
  isOverdue: boolean
}

interface TodayPanelProps {
  solves: LcSolveWithReviews[]
  today: string
  newSolvesToday: number
  onReviewComplete: (reviewId: string, solveId: string) => void
  onSolveLogged: (solve: LcSolveWithReviews, isNewSolve: boolean) => void
  onRescheduleComplete: () => void
}

const DIFFICULTY_COLOR = {
  easy: 'text-emerald-400',
  medium: 'text-yellow-400',
  hard: 'text-red-400',
}

const DIFFICULTY_BADGE = {
  easy: 'text-emerald-400 bg-emerald-500/10',
  medium: 'text-yellow-400 bg-yellow-500/10',
  hard: 'text-red-400 bg-red-500/10',
}

function ExternalLinkIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

export function TodayPanel({
  solves,
  today,
  newSolvesToday,
  onReviewComplete,
  onSolveLogged,
  onRescheduleComplete,
}: TodayPanelProps) {
  const [completing, setCompleting] = useState<Set<string>>(new Set())
  const [flashing, setFlashing] = useState<Set<string>>(new Set())
  const [solvingSlug, setSolvingSlug] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState(false)

  const activeCategory = useMemo(() => getActiveCategory(solves), [solves])

  const recommendations = useMemo(() => getRecommendations(solves), [solves])

  const categoryProgress = useMemo(
    () => (activeCategory ? getCategoryProgress(solves, activeCategory) : null),
    [solves, activeCategory]
  )

  const nextProblemPreview = useMemo(() => {
    const extended = getRecommendations(solves, DAILY_NEW_TARGET + 1)
    return extended.length > DAILY_NEW_TARGET ? extended[DAILY_NEW_TARGET] : null
  }, [solves])

  const dueItems = useMemo<ReviewItem[]>(() => {
    const items: ReviewItem[] = []
    for (const solve of solves) {
      for (const review of solve.lc_reviews) {
        if (review.completed_at) continue
        if (review.scheduled_for > today) continue
        items.push({ review, solve, isOverdue: review.scheduled_for < today })
      }
    }
    items.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
      return a.review.scheduled_for.localeCompare(b.review.scheduled_for)
    })
    return items
  }, [solves, today])

  const overdueCount = useMemo(() => dueItems.filter(i => i.isOverdue).length, [dueItems])

  async function handleInlineSolve(problem: NeetcodeProblem) {
    if (solvingSlug) return
    setSolvingSlug(problem.slug)
    try {
      const res = await fetch('/api/dsa/solves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_slug: problem.slug,
          problem_title: problem.title,
          pattern: problem.pattern,
          difficulty: problem.difficulty,
          solved_at: today,
        }),
      })
      if (!res.ok) return
      const { id, isNewSolve } = await res.json() as { id: string; isNewSolve: boolean }
      const solveRes = await fetch('/api/dsa/solves')
      if (solveRes.ok) {
        const allSolves: LcSolveWithReviews[] = await solveRes.json()
        const updated = allSolves.find(s => s.id === id)
        if (updated) onSolveLogged(updated, isNewSolve)
      }
    } finally {
      setSolvingSlug(null)
    }
  }

  async function handleRescheduleClick() {
    setRescheduling(true)
    try {
      const res = await fetch('/api/dsa/reviews/reschedule', { method: 'POST' })
      if (res.ok) onRescheduleComplete()
    } finally {
      setRescheduling(false)
    }
  }

  async function markReview(item: ReviewItem, difficulty: 'easy' | 'hard') {
    if (completing.has(item.review.id)) return
    setCompleting(prev => new Set(prev).add(item.review.id))

    if (difficulty === 'hard') {
      setFlashing(prev => new Set(prev).add(item.review.id))
      // Fire PATCH immediately, parallel with the 300ms flash
      fetch(`/api/dsa/reviews/${item.review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty }),
      })
      // After 300ms flash, trigger card exit
      setTimeout(() => {
        onReviewComplete(item.review.id, item.solve.id)
      }, 300)
    } else {
      // Easy: wait for PATCH, then trigger exit
      try {
        await fetch(`/api/dsa/reviews/${item.review.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ difficulty }),
        })
        onReviewComplete(item.review.id, item.solve.id)
      } finally {
        setCompleting(prev => {
          const next = new Set(prev)
          next.delete(item.review.id)
          return next
        })
      }
    }
  }

  const allSolved = activeCategory === null
  const isDoneToday = !allSolved && newSolvesToday >= DAILY_NEW_TARGET

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Do Today ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-zinc-800 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-zinc-400">Do Today</p>
          {activeCategory && categoryProgress && (
            <span className="text-[10px] font-medium text-zinc-500 tabular-nums truncate ml-2 max-w-[60%] text-right">
              {activeCategory} · {categoryProgress.solved}/{categoryProgress.total}
            </span>
          )}
        </div>

        {allSolved ? (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-center">
            <p className="text-sm font-medium text-emerald-400">All 150 solved!</p>
            <p className="text-xs text-zinc-500 mt-0.5">Consider re-solving to reset your chains</p>
          </div>
        ) : isDoneToday ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
          >
            <p className="text-sm font-medium text-emerald-400">✓ New problems done for today</p>
            {nextProblemPreview && (
              <p className="text-xs text-zinc-500 mt-1">
                Next up tomorrow: {nextProblemPreview.title}
              </p>
            )}
          </motion.div>
        ) : (
          <div className="space-y-2">
            {recommendations.map(problem => (
              <div
                key={problem.slug}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2.5 hover:border-zinc-700 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm font-medium text-zinc-100 truncate">{problem.title}</span>
                    <a
                      href={problem.leetcodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-zinc-600 hover:text-blue-400 transition-colors"
                      title="Open problem"
                    >
                      <ExternalLinkIcon />
                    </a>
                  </div>
                  <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${DIFFICULTY_BADGE[problem.difficulty]}`}>
                    {problem.difficulty}
                  </span>
                </div>
                <button
                  onClick={() => handleInlineSolve(problem)}
                  disabled={!!solvingSlug}
                  className="shrink-0 flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:border-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-all"
                >
                  {solvingSlug === problem.slug ? (
                    <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    'Solved ✓'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Catch-up banner ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {overdueCount > 3 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden"
          >
            <div className="mx-5 mt-3 rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-2.5 flex items-center justify-between gap-3">
              <p className="text-xs text-orange-400 font-medium">{overdueCount} reviews overdue</p>
              <button
                onClick={handleRescheduleClick}
                disabled={rescheduling}
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-md border border-orange-500/40 text-orange-400 hover:bg-orange-500/15 disabled:opacity-50 transition-colors"
              >
                {rescheduling ? 'Pushing...' : 'Push all to today'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Review Today ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-400">Review Today</p>
          {dueItems.length > 0 && (
            <span className="text-xs font-medium text-zinc-500">{dueItems.length} due</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <AnimatePresence initial={false}>
          {dueItems.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-24 gap-2"
            >
              <p className="text-sm text-zinc-500">All caught up</p>
            </motion.div>
          ) : (
            dueItems.map((item, i) => (
              <motion.div
                key={item.review.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.18 } }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                className="mb-2"
              >
                <div className="group flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 hover:border-zinc-700 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {item.isOverdue ? (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-orange-500/15 text-orange-400">
                          overdue
                        </span>
                      ) : (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/15 text-blue-400">
                          review
                        </span>
                      )}
                      <span className={`text-[10px] font-medium ${DIFFICULTY_COLOR[item.solve.difficulty]}`}>
                        {item.solve.difficulty}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-zinc-100 truncate">{item.solve.problem_title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{item.solve.pattern}</p>
                  </div>
                  {flashing.has(item.review.id) ? (
                    <span className="shrink-0 text-xs text-orange-400 font-medium">↺ Back tomorrow</span>
                  ) : (
                    <div className="shrink-0 flex items-center gap-1.5">
                      {/* Easy */}
                      <button
                        onClick={() => markReview(item, 'easy')}
                        disabled={completing.has(item.review.id)}
                        aria-label="Mark as easy — schedules next review further out"
                        className="shrink-0 flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:border-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-all"
                      >
                        {completing.has(item.review.id) ? (
                          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                        Easy
                      </button>
                      {/* Hard */}
                      <button
                        onClick={() => markReview(item, 'hard')}
                        disabled={completing.has(item.review.id)}
                        aria-label="Mark as hard — resets review to tomorrow"
                        className="shrink-0 flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:border-orange-500/60 hover:text-orange-400 hover:bg-orange-500/10 disabled:opacity-40 transition-all"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.85l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Hard
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
