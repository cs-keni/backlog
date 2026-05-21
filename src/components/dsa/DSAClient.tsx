'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { getTodayLocal } from '@/lib/dsa/schedule'
import type { LcSolveWithReviews } from '@/lib/dsa/types'
import { TRACK_PROBLEMS } from '@/lib/dsa/neetcode150'
import type { DsaTrack } from '@/lib/dsa/neetcode150'
import { TodayPanel } from './TodayPanel'
import { CalendarView } from './CalendarView'
import { ProblemLogger } from './ProblemLogger'

interface DSAClientProps {
  initialSolves: LcSolveWithReviews[]
  initialNewSolvesToday: number
  initialTrack: DsaTrack
  openTechnicalApps: { company: string; applied_at: string | null }[]
}

type MobileTab = 'today' | 'calendar' | 'problems'

const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'problems', label: 'Problems' },
]

const TRACKS: DsaTrack[] = ['75', '150', '250']

export function DSAClient({
  initialSolves,
  initialNewSolvesToday,
  initialTrack,
  openTechnicalApps,
}: DSAClientProps) {
  const today = getTodayLocal()

  const [solves, setSolves] = useState<LcSolveWithReviews[]>(initialSolves)
  const [mobileTab, setMobileTab] = useState<MobileTab>('today')
  const [newSolvesToday, setNewSolvesToday] = useState(initialNewSolvesToday)
  const [track, setTrack] = useState<DsaTrack>(initialTrack)
  const [trackSaving, setTrackSaving] = useState(false)

  const filteredSolves = useMemo(() => {
    const allowed = TRACK_PROBLEMS[track]
    return solves.filter(solve => allowed.has(solve.problem_slug))
  }, [solves, track])

  const dueCount = useMemo(() => {
    let n = 0
    for (const s of filteredSolves) {
      for (const r of s.lc_reviews) {
        if (!r.completed_at && r.scheduled_for <= today) n++
      }
    }
    return n
  }, [filteredSolves, today])

  async function handleTrackChange(nextTrack: DsaTrack) {
    if (nextTrack === track || trackSaving) return
    const previousTrack = track
    setTrack(nextTrack)
    setTrackSaving(true)
    try {
      const res = await fetch('/api/dsa/track', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: nextTrack }),
      })
      if (!res.ok) setTrack(previousTrack)
    } catch {
      setTrack(previousTrack)
    } finally {
      setTrackSaving(false)
    }
  }

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

  const handleSolveLogged = useCallback((newSolve: LcSolveWithReviews, isNewSolve: boolean) => {
    setSolves((prev) => {
      const without = prev.filter((s) => s.problem_slug !== newSolve.problem_slug)
      return [newSolve, ...without]
    })
    if (isNewSolve && newSolve.solved_at === today) setNewSolvesToday(n => n + 1)
  }, [today])

  const handleReschedule = useCallback(() => {
    const t = getTodayLocal()
    setSolves(prev => prev.map(s => ({
      ...s,
      lc_reviews: s.lc_reviews.map(r =>
        !r.completed_at && r.scheduled_for < t
          ? { ...r, scheduled_for: t }
          : r
      ),
    })))
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
        <h1 className="text-sm font-semibold text-zinc-100">DSA</h1>
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          {TRACKS.map(option => (
            <button
              key={option}
              onClick={() => handleTrackChange(option)}
              disabled={trackSaving}
              className={`min-w-10 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                track === option
                  ? 'bg-teal-500/15 text-teal-300'
                  : 'text-zinc-500 hover:text-zinc-300'
              } disabled:opacity-60`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* ── Desktop layout (md+) ────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-[420px] shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
          <TodayPanel
            solves={filteredSolves}
            today={today}
            newSolvesToday={newSolvesToday}
            track={track}
            openTechnicalApps={openTechnicalApps}
            onReviewComplete={handleReviewComplete}
            onSolveLogged={handleSolveLogged}
            onRescheduleComplete={handleReschedule}
          />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="shrink-0 border-b border-zinc-800 p-5">
            <CalendarView solves={filteredSolves} today={today} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <ProblemLogger solves={filteredSolves} today={today} track={track} onSolveLogged={handleSolveLogged} />
          </div>
        </div>
      </div>

      {/* ── Mobile layout (<md) ─────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
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
              solves={filteredSolves}
              today={today}
              newSolvesToday={newSolvesToday}
              track={track}
              openTechnicalApps={openTechnicalApps}
              onReviewComplete={handleReviewComplete}
              onSolveLogged={handleSolveLogged}
              onRescheduleComplete={handleReschedule}
            />
          )}
          {mobileTab === 'calendar' && (
            <div className="overflow-y-auto h-full p-5">
              <CalendarView solves={filteredSolves} today={today} />
            </div>
          )}
          {mobileTab === 'problems' && (
            <div className="overflow-y-auto h-full">
              <ProblemLogger solves={filteredSolves} today={today} track={track} onSolveLogged={handleSolveLogged} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
