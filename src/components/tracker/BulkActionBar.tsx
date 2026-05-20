'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

interface BulkActionBarProps {
  selectedCount: number
  isLoading: boolean
  error: string | null
  onArchive: () => void
  onDismiss: () => void
}

export function BulkActionBar({ selectedCount, isLoading, error, onArchive, onDismiss }: BulkActionBarProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  if (!mounted) return null

  return createPortal(
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      role="toolbar"
      aria-label="Bulk actions"
      className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 backdrop-blur-xl bg-zinc-900/90 border border-zinc-700/60 shadow-xl shadow-black/40 rounded-full px-4 py-2.5"
      style={{ bottom: 'max(24px, calc(env(safe-area-inset-bottom) + 8px))' }}
    >
      {/* Count badge */}
      <span className="bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap">
        {selectedCount} selected
      </span>

      <div className="border-r border-zinc-700 h-4" />

      {/* Archive button */}
      <button
        disabled={isLoading}
        onClick={onArchive}
        aria-label={`Archive ${selectedCount} selected applications`}
        className="flex items-center gap-1.5 border border-zinc-700 text-zinc-400 hover:border-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg px-3 py-1 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        )}
        Archive
      </button>

      {/* Inline error */}
      {error && (
        <span className="text-xs text-red-400 whitespace-nowrap">{error}</span>
      )}

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label="Clear selection"
        className="text-zinc-600 hover:text-zinc-300 ml-2 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>,
    document.body
  )
}
