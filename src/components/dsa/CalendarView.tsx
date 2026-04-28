'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { LcSolveWithReviews } from '@/lib/dsa/types'

interface CalendarViewProps {
  solves: LcSolveWithReviews[]
  today: string
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

export function CalendarView({ solves, today }: CalendarViewProps) {
  const [todayYear, todayMonth] = today.split('-').map(Number)
  const [viewYear, setViewYear] = useState(todayYear)
  const [viewMonth, setViewMonth] = useState(todayMonth - 1)

  const reviewCountByDate = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const solve of solves) {
      for (const review of solve.lc_reviews) {
        if (review.completed_at) continue
        counts[review.scheduled_for] = (counts[review.scheduled_for] ?? 0) + 1
      }
    }
    return counts
  }, [solves])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDow = getFirstDayOfWeek(viewYear, viewMonth)
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthKey = `${viewYear}-${viewMonth}`

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="flex items-center justify-center h-6 w-6 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-xs font-medium text-zinc-300">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="flex items-center justify-center h-6 w-6 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-zinc-600 pb-1">{d}</div>
        ))}
      </div>

      <motion.div
        key={monthKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="grid grid-cols-7 gap-y-1"
      >
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />
          const dateKey = toDateKey(viewYear, viewMonth, day)
          const count = reviewCountByDate[dateKey] ?? 0
          const isToday = dateKey === today
          return (
            <motion.div
              key={dateKey}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.005, duration: 0.12 }}
              className="flex flex-col items-center py-1"
            >
              <div
                className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium transition-colors ${
                  isToday
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-400'
                }`}
              >
                {day}
              </div>
              {count > 0 && (
                <div className="mt-0.5 flex gap-0.5 flex-wrap justify-center">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <div key={i} className="h-1 w-1 rounded-full bg-blue-500" />
                  ))}
                  {count > 3 && <div className="h-1 w-1 rounded-full bg-blue-300" />}
                </div>
              )}
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
