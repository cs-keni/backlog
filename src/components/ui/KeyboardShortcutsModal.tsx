'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

interface ShortcutGroup {
  heading: string
  shortcuts: { keys: string[]; description: string }[]
}

const GROUPS: ShortcutGroup[] = [
  {
    heading: 'Global',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close panel or dialog' },
    ],
  },
  {
    heading: 'Job Feed',
    shortcuts: [
      { keys: ['J'], description: 'Next job' },
      { keys: ['K'], description: 'Previous job' },
      { keys: ['A'], description: 'Quick-apply to selected job' },
      { keys: ['F'], description: 'Focus filter sidebar' },
      { keys: ['Enter'], description: 'Open job detail' },
    ],
  },
  {
    heading: 'Tracker',
    shortcuts: [
      { keys: ['L'], description: 'Log new application' },
    ],
  },
]

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[900] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="fixed left-1/2 top-1/4 z-[901] w-full max-w-[400px] -translate-x-1/2 rounded-2xl border border-zinc-700/60 bg-zinc-900 shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">Keyboard Shortcuts</h2>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="divide-y divide-zinc-800/60">
              {GROUPS.map((group) => (
                <div key={group.heading} className="px-5 py-4 space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                    {group.heading}
                  </p>
                  {group.shortcuts.map((s) => (
                    <div
                      key={s.description}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-zinc-400">{s.description}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((key, i) => (
                          <kbd
                            key={i}
                            className="flex items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300 min-w-[22px]"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
