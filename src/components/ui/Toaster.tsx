'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  title: string
  description?: string
  type?: ToastType
  duration?: number
}

interface ToastItem extends ToastOptions {
  id: string
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  error: (
    <svg className="h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="h-4 w-4 shrink-0 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374l7.106-12.248c.865-1.5 3.032-1.5 3.897 0L21.303 16.126zM12 15.75h.008v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="h-4 w-4 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
}

const ACCENT: Record<ToastType, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  warning: 'border-l-yellow-500',
  info: 'border-l-blue-500',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = Math.random().toString(36).slice(2)
      const duration = opts.duration ?? 4000
      setToasts((prev) => {
        const next = [...prev, { ...opts, id }]
        return next.slice(-4)
      })
      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            aria-label="Notifications"
            className="fixed bottom-5 right-5 z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
          >
            <AnimatePresence mode="popLayout">
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className={`pointer-events-auto flex items-start gap-3 w-[320px] max-w-[90vw] rounded-xl border border-zinc-700/60 border-l-2 bg-zinc-900 px-3.5 py-3 shadow-xl shadow-black/40 ${ACCENT[t.type ?? 'info']}`}
                >
                  <span className="mt-0.5">{ICONS[t.type ?? 'info']}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 leading-snug">
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => dismiss(t.id)}
                    className="shrink-0 mt-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"
                    aria-label="Dismiss"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  )
}
