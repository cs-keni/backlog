'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SortOption } from '@/lib/jobs/types'

interface FeedHeaderProps {
  sort: SortOption
  onSortChange: (sort: SortOption) => void
  onJobAdded: (jobId: string) => void
}

export function FeedHeader({ sort, onSortChange, onJobAdded }: FeedHeaderProps) {
  const [urlInput, setUrlInput] = useState('')
  const [urlState, setUrlState] = useState<'idle' | 'loading' | 'success' | 'error' | 'js-rendered'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleAddFromUrl(e: React.FormEvent) {
    e.preventDefault()
    const url = urlInput.trim()
    if (!url || urlState === 'loading') return

    setUrlState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/jobs/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json() as { job?: { id: string }; error?: string; jsRendered?: boolean; duplicate?: boolean }

      if (res.ok && data.job) {
        setUrlState('success')
        setUrlInput('')
        onJobAdded(data.job.id)
        setTimeout(() => setUrlState('idle'), 3000)
      } else if (res.status === 422 && data.jsRendered) {
        setUrlState('js-rendered')
        setErrorMsg('This page requires JavaScript to load. Open it in Chrome and use the Backlog extension instead.')
      } else {
        setUrlState('error')
        setErrorMsg(data.error ?? 'Failed to fetch job.')
        setTimeout(() => setUrlState('idle'), 4000)
      }
    } catch {
      setUrlState('error')
      setErrorMsg('Could not reach server.')
      setTimeout(() => setUrlState('idle'), 4000)
    }
  }

  return (
    <div className="space-y-3 pb-4 border-b border-zinc-800">
      {/* Title + sort */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-zinc-100">Job Feed</h1>
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5">
          {(['newest', 'salary'] as SortOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => onSortChange(opt)}
              className={`relative px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                sort === opt ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {sort === opt && (
                <motion.div
                  layoutId="sort-pill"
                  className="absolute inset-0 bg-zinc-700 rounded-md"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative capitalize">{opt === 'newest' ? 'Newest' : 'Salary'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Add from URL */}
      <form onSubmit={handleAddFromUrl} className="relative">
        <input
          ref={inputRef}
          type="url"
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value)
            if (urlState !== 'idle') setUrlState('idle')
          }}
          placeholder="Paste a job URL to add it…"
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 pr-16 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!urlInput.trim() || urlState === 'loading'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-zinc-700 text-xs text-zinc-300 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {urlState === 'loading' ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </span>
          ) : (
            'Add'
          )}
        </button>
      </form>

      {/* Feedback messages */}
      <AnimatePresence>
        {urlState === 'success' && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-emerald-400"
          >
            Job added to your feed.
          </motion.p>
        )}
        {(urlState === 'error' || urlState === 'js-rendered') && errorMsg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-red-400"
          >
            {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
