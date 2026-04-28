'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NEETCODE_150, PATTERNS } from '@/lib/dsa/neetcode150'
import { getTodayLocal } from '@/lib/dsa/schedule'
import type { LcSolveWithReviews } from '@/lib/dsa/types'
import type { NeetcodeProblem } from '@/lib/dsa/neetcode150'

interface ProblemLoggerProps {
  solves: LcSolveWithReviews[]
  today: string
  onSolveLogged: (solve: LcSolveWithReviews) => void
}

const DIFFICULTY_COLOR = {
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

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <motion.svg
      animate={{ rotate: collapsed ? -90 : 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-3.5 w-3.5 text-zinc-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </motion.svg>
  )
}

export function ProblemLogger({ solves, today, onSolveLogged }: ProblemLoggerProps) {
  const [query, setQuery] = useState('')
  const [selectedPattern, setSelectedPattern] = useState<string>('All')
  const [logging, setLogging] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Bulk mode state
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkDate, setBulkDate] = useState(today)
  const [bulkLogging, setBulkLogging] = useState(false)

  const solveBySlug = useMemo(() => {
    const map: Record<string, LcSolveWithReviews> = {}
    for (const s of solves) map[s.problem_slug] = s
    return map
  }, [solves])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return NEETCODE_150.filter((p) => {
      const matchesPattern = selectedPattern === 'All' || p.pattern === selectedPattern
      const matchesQuery = !q || p.title.toLowerCase().includes(q) || p.pattern.toLowerCase().includes(q)
      return matchesPattern && matchesQuery
    })
  }, [query, selectedPattern])

  // Grouped view when "All" is selected; flat otherwise
  const groups = useMemo(() => {
    if (selectedPattern !== 'All') return null
    return PATTERNS
      .map((p) => ({ pattern: p, problems: filtered.filter((prob) => prob.pattern === p) }))
      .filter((g) => g.problems.length > 0)
  }, [filtered, selectedPattern])

  function toggleGroup(pattern: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(pattern)) next.delete(pattern)
      else next.add(pattern)
      return next
    })
  }

  async function logSolve(problem: NeetcodeProblem, solvedAt: string) {
    const body = {
      problem_slug: problem.slug,
      problem_title: problem.title,
      pattern: problem.pattern,
      difficulty: problem.difficulty,
      solved_at: solvedAt,
    }

    const res = await fetch('/api/dsa/solves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed to log solve')

    const { id } = await res.json()

    const solveRes = await fetch('/api/dsa/solves')
    if (solveRes.ok) {
      const allSolves: LcSolveWithReviews[] = await solveRes.json()
      const updated = allSolves.find((s) => s.id === id)
      if (updated) onSolveLogged(updated)
    }
  }

  async function handleLogClick(problem: NeetcodeProblem) {
    if (solveBySlug[problem.slug] && confirmReset !== problem.slug) {
      setConfirmReset(problem.slug)
      return
    }
    setConfirmReset(null)
    setLogging(problem.slug)
    try {
      await logSolve(problem, getTodayLocal())
    } finally {
      setLogging(null)
    }
  }

  async function handleBulkLog() {
    if (bulkSelected.size === 0) return
    setBulkLogging(true)
    try {
      for (const slug of bulkSelected) {
        const problem = NEETCODE_150.find((p) => p.slug === slug)
        if (!problem) continue
        await logSolve(problem, bulkDate)
      }
      setBulkSelected(new Set())
      setBulkMode(false)
    } finally {
      setBulkLogging(false)
    }
  }

  function renderProblemRow(problem: NeetcodeProblem, index: number) {
    const existing = solveBySlug[problem.slug]
    const isBulkSelected = bulkSelected.has(problem.slug)

    return (
      <motion.div
        key={problem.slug}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.01, 0.2), duration: 0.15 }}
      >
        <div
          className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 border transition-colors ${
            bulkMode && isBulkSelected
              ? 'border-blue-500/50 bg-blue-500/5'
              : 'border-zinc-800/60 hover:border-zinc-700'
          } ${bulkMode ? 'cursor-pointer' : ''}`}
          onClick={bulkMode ? () => {
            setBulkSelected((prev) => {
              const next = new Set(prev)
              if (next.has(problem.slug)) next.delete(problem.slug)
              else next.add(problem.slug)
              return next
            })
          } : undefined}
        >
          {bulkMode && (
            <div className={`shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors ${
              isBulkSelected ? 'bg-blue-500 border-blue-500' : 'border-zinc-600'
            }`}>
              {isBulkSelected && (
                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-zinc-200 truncate">{problem.title}</span>
              {existing && (
                <svg className="shrink-0 h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              <a
                href={problem.leetcodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Open on LeetCode"
                className="shrink-0 text-zinc-600 hover:text-yellow-400 transition-colors"
              >
                <ExternalLinkIcon />
              </a>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {groups === null && (
                <>
                  <span className="text-[10px] text-zinc-600">{problem.pattern}</span>
                  <span className="text-zinc-700">·</span>
                </>
              )}
              <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${DIFFICULTY_COLOR[problem.difficulty]}`}>
                {problem.difficulty}
              </span>
              {existing && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="text-[10px] text-zinc-600">last: {existing.solved_at}</span>
                </>
              )}
            </div>
          </div>

          {!bulkMode && (
            <div className="shrink-0">
              <AnimatePresence mode="wait">
                {confirmReset === problem.slug ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1.5"
                  >
                    <span className="text-[10px] text-zinc-500">Reset chain?</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLogClick(problem) }}
                      className="text-[10px] px-2 py-1 rounded bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmReset(null) }}
                      className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
                    >
                      No
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="log"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={(e) => { e.stopPropagation(); handleLogClick(problem) }}
                    disabled={logging === problem.slug}
                    className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-40 transition-all"
                  >
                    {logging === problem.slug ? (
                      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : existing ? (
                      'Re-solve'
                    ) : (
                      'Solved'
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  const patternOptions = ['All', ...PATTERNS]

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-zinc-400">Problems</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600">{solves.length}/150 solved</span>
            <button
              onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()) }}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                bulkMode
                  ? 'border-blue-500/50 text-blue-400 bg-blue-500/10'
                  : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
              }`}
            >
              {bulkMode ? 'Cancel bulk' : 'Log past solves'}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search problems..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors"
          />
          <select
            value={selectedPattern}
            onChange={(e) => setSelectedPattern(e.target.value)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600 transition-colors"
          >
            {patternOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <AnimatePresence>
          {bulkMode && bulkSelected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-center gap-2 overflow-hidden"
            >
              <input
                type="date"
                value={bulkDate}
                max={today}
                onChange={(e) => setBulkDate(e.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none focus:border-zinc-600"
              />
              <button
                onClick={handleBulkLog}
                disabled={bulkLogging}
                className="flex-1 rounded-md border border-blue-500/50 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
              >
                {bulkLogging ? 'Logging...' : `Log ${bulkSelected.size} solve${bulkSelected.size !== 1 ? 's' : ''}`}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto">
        {groups ? (
          // Grouped view (All categories)
          <div className="py-2">
            {groups.map((group) => {
              const solvedCount = group.problems.filter((p) => solveBySlug[p.slug]).length
              const isCollapsed = collapsedGroups.has(group.pattern) && !query
              const allSolved = solvedCount === group.problems.length

              return (
                <div key={group.pattern}>
                  <button
                    onClick={() => !query && toggleGroup(group.pattern)}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                      query ? 'cursor-default' : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    {!query && <ChevronIcon collapsed={isCollapsed} />}
                    <span className="text-xs font-semibold text-zinc-300 flex-1">{group.pattern}</span>
                    <span className={`text-[10px] font-medium tabular-nums ${
                      allSolved ? 'text-emerald-400' : 'text-zinc-600'
                    }`}>
                      {solvedCount}/{group.problems.length}
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="px-3 pb-1 space-y-1">
                          {group.problems.map((problem, i) => renderProblemRow(problem, i))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        ) : (
          // Flat view (single category filtered)
          <div className="px-3 py-3 space-y-1">
            {filtered.map((problem, i) => renderProblemRow(problem, i))}
          </div>
        )}
      </div>
    </div>
  )
}
