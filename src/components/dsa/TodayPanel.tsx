'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LcSolveWithReviews, LcReview } from '@/lib/dsa/types'

interface ReviewItem {
  review: LcReview
  solve: LcSolveWithReviews
  isOverdue: boolean
}

interface TodayPanelProps {
  solves: LcSolveWithReviews[]
  today: string
  onReviewComplete: (reviewId: string, solveId: string) => void
}

const DIFFICULTY_COLOR = {
  easy: 'text-emerald-400',
  medium: 'text-yellow-400',
  hard: 'text-red-400',
}

export function TodayPanel({ solves, today, onReviewComplete }: TodayPanelProps) {
  const [completing, setCompleting] = useState<Set<string>>(new Set())

  const dueItems = useMemo<ReviewItem[]>(() => {
    const items: ReviewItem[] = []
    for (const solve of solves) {
      for (const review of solve.lc_reviews) {
        if (review.completed_at) continue
        if (review.scheduled_for > today) continue
        items.push({
          review,
          solve,
          isOverdue: review.scheduled_for < today,
        })
      }
    }
    // Overdue first, then by scheduled date
    items.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
      return a.review.scheduled_for.localeCompare(b.review.scheduled_for)
    })
    return items
  }, [solves, today])

  async function markDone(item: ReviewItem) {
    if (completing.has(item.review.id)) return
    setCompleting((prev) => new Set(prev).add(item.review.id))
    try {
      await fetch(`/api/dsa/reviews/${item.review.id}`, { method: 'PATCH' })
      onReviewComplete(item.review.id, item.solve.id)
    } finally {
      setCompleting((prev) => {
        const next = new Set(prev)
        next.delete(item.review.id)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-400">Today&apos;s Reviews</p>
          {dueItems.length > 0 && (
            <span className="text-xs font-medium text-zinc-500">{dueItems.length} due</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <AnimatePresence initial={false}>
          {dueItems.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-40 gap-2"
            >
              <div className="text-2xl">✓</div>
              <p className="text-sm text-zinc-500">All caught up for today</p>
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
                  <button
                    onClick={() => markDone(item)}
                    disabled={completing.has(item.review.id)}
                    className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md border border-zinc-700 text-zinc-500 hover:border-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-all"
                  >
                    {completing.has(item.review.id) ? (
                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
