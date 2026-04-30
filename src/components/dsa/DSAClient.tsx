'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { getTodayLocal } from '@/lib/dsa/schedule'
import type { LcSolveWithReviews } from '@/lib/dsa/types'
import { TodayPanel } from './TodayPanel'
import { CalendarView } from './CalendarView'
import { ProblemLogger } from './ProblemLogger'

interface DSAClientProps {
  initialSolves: LcSolveWithReviews[]
}

type MobileTab = 'today' | 'calendar' | 'problems'

const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'problems', label: 'Problems' },
]

export function DSAClient({ initialSolves }: DSAClientProps) {
  const [solves, setSolves] = useState<LcSolveWithReviews[]>(initialSolves)
  const [mobileTab, setMobileTab] = useState<MobileTab>('today')

  const today = getTodayLocal()

  const dueCount = useMemo(() => {
    let n = 0
    for (const s of solves) {
      for (const r of s.lc_reviews) {
        if (!r.completed_at && r.scheduled_for <= today) n++
      }
    }
    return n
  }, [solves, today])

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
    <>
      {/* ── Desktop layout (md+) ────────────────────────────────────────────── */}
      <div className="hidden md:flex h-full overflow-hidden">
        <div className="w-[420px] shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
          <TodayPanel
            solves={solves}
            today={today}
            onReviewComplete={handleReviewComplete}
          />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="shrink-0 border-b border-zinc-800 p-5">
            <CalendarView solves={solves} today={today} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <ProblemLogger solves={solves} today={today} onSolveLogged={handleSolveLogged} />
          </div>
        </div>
      </div>

      {/* ── Mobile layout (<md) ─────────────────────────────────────────────── */}
      <div className="flex md:hidden h-full flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="shrink-0 flex border-b border-zinc-800 px-3 pt-1">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                mobileTab === tab.id ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
              {tab.id === 'today' && dueCount > 0 && (
                <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-semibold tabular-nums">
                  {dueCount}
                </span>
              )}
              {mobileTab === tab.id && (
                <motion.span
                  layoutId="dsa-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100 rounded-full"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === 'today' && (
            <TodayPanel
              solves={solves}
              today={today}
              onReviewComplete={handleReviewComplete}
            />
          )}
          {mobileTab === 'calendar' && (
            <div className="overflow-y-auto h-full p-5">
              <CalendarView solves={solves} today={today} />
            </div>
          )}
          {mobileTab === 'problems' && (
            <div className="overflow-y-auto h-full">
              <ProblemLogger solves={solves} today={today} onSolveLogged={handleSolveLogged} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
