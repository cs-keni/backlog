'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type State = 'idle' | 'loading' | 'success' | 'error'

export default function RefreshButton() {
  const [state, setState] = useState<State>('idle')
  const [count, setCount] = useState<number | null>(null)

  const handleRefresh = async () => {
    if (state === 'loading') return
    setState('loading')
    setCount(null)

    try {
      const res = await fetch('/api/admin/trigger', { method: 'POST' })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as { written: number; skipped: boolean }
      setCount(data.written)
      setState('success')
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const bgClass =
    state === 'success'
      ? 'bg-emerald-500 border-emerald-500 text-white'
      : state === 'error'
        ? 'bg-red-500 border-red-500 text-white'
        : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600'

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <motion.button
        onClick={handleRefresh}
        disabled={state === 'loading'}
        whileHover={state !== 'loading' ? { scale: 1.04 } : {}}
        whileTap={state !== 'loading' ? { scale: 0.96 } : {}}
        className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-lg shadow-black/30 transition-colors ${bgClass}`}
        title="Check for new jobs"
      >
        <motion.svg
          animate={state === 'loading' ? { rotate: 360 } : { rotate: 0 }}
          transition={
            state === 'loading'
              ? { repeat: Infinity, duration: 0.9, ease: 'linear' }
              : { duration: 0 }
          }
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </motion.svg>

        <AnimatePresence mode="wait" initial={false}>
          {state === 'idle' && (
            <motion.span
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              Refresh
            </motion.span>
          )}
          {state === 'loading' && (
            <motion.span
              key="loading"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              Checking...
            </motion.span>
          )}
          {state === 'success' && (
            <motion.span
              key="success"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {count === 0 ? 'Up to date' : `${count} new job${count === 1 ? '' : 's'}`}
            </motion.span>
          )}
          {state === 'error' && (
            <motion.span
              key="error"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              Failed
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
