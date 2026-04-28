'use client'

import { useState, useCallback } from 'react'
import { getTodayLocal } from '@/lib/dsa/schedule'
import type { LcSolveWithReviews } from '@/lib/dsa/types'
import { TodayPanel } from './TodayPanel'
import { CalendarView } from './CalendarView'
import { ProblemLogger } from './ProblemLogger'

interface DSAClientProps {
  initialSolves: LcSolveWithReviews[]
}

export function DSAClient({ initialSolves }: DSAClientProps) {
  const [solves, setSolves] = useState<LcSolveWithReviews[]>(initialSolves)

  const today = getTodayLocal()

  const handleReviewComplete = useCallback((reviewId: string, solveId: string) => {
    setSolves((prev) =>
      prev.map((s) => {
        if (s.id !== solveId) return s
        return {
          ...s,
          lc_reviews: s.lc_reviews.map((r) =>
            r.id === reviewId
              ? { ...r, completed_at: new Date().toISOString() }
              : r
          ),
        }
      })
    )
  }, [])

  const handleSolveLogged = useCallback((newSolve: LcSolveWithReviews) => {
    setSolves((prev) => {
      const without = prev.filter((s) => s.problem_slug !== newSolve.problem_slug)
      return [newSolve, ...without]
    })
  }, [])

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Today's reviews */}
      <div className="w-[420px] shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
        <TodayPanel
          solves={solves}
          today={today}
          onReviewComplete={handleReviewComplete}
        />
      </div>

      {/* Right: Calendar + Problem Logger */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-zinc-800 p-5">
          <CalendarView solves={solves} today={today} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ProblemLogger solves={solves} today={today} onSolveLogged={handleSolveLogged} />
        </div>
      </div>
    </div>
  )
}
