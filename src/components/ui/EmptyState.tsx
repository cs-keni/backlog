'use client'

import { motion } from 'framer-motion'

// ─── Illustrations ────────────────────────────────────────────────────────────

function TelescopeIllustration() {
  return (
    <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-20">
      {/* Stars */}
      <circle cx="15" cy="18" r="1.5" fill="#3f3f46" />
      <circle cx="95" cy="12" r="1" fill="#3f3f46" />
      <circle cx="108" cy="30" r="1.5" fill="#52525b" />
      <circle cx="28" cy="8" r="1" fill="#52525b" />
      <circle cx="78" cy="22" r="2" fill="#3f3f46" />
      <circle cx="50" cy="6" r="1" fill="#3f3f46" />
      {/* Telescope body — angled tube */}
      <rect x="38" y="40" width="48" height="14" rx="7" fill="#27272a" stroke="#3f3f46" strokeWidth="1.5" transform="rotate(-25 38 40)" />
      {/* Eyepiece */}
      <rect x="72" y="54" width="16" height="10" rx="5" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" transform="rotate(-25 72 54)" />
      {/* Lens ring */}
      <circle cx="42" cy="38" r="9" fill="#18181b" stroke="#6366f1" strokeWidth="1.5" />
      <circle cx="42" cy="38" r="5" fill="#27272a" stroke="#4f46e5" strokeWidth="1" opacity="0.6" />
      <circle cx="42" cy="38" r="2" fill="#6366f1" opacity="0.4" />
      {/* Tripod legs */}
      <line x1="60" y1="62" x2="48" y2="90" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />
      <line x1="64" y1="62" x2="76" y2="90" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />
      <line x1="62" y1="62" x2="62" y2="90" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />
      {/* Tripod crossbar */}
      <line x1="51" y1="80" x2="73" y2="80" stroke="#3f3f46" strokeWidth="1.5" strokeLinecap="round" />
      {/* Glow around lens */}
      <circle cx="42" cy="38" r="12" fill="none" stroke="#6366f1" strokeWidth="0.5" opacity="0.3" />
    </svg>
  )
}

function KanbanIllustration() {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-20">
      {/* Board background */}
      <rect x="8" y="18" width="104" height="62" rx="8" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
      {/* Column headers */}
      <rect x="16" y="26" width="28" height="7" rx="3.5" fill="#27272a" />
      <rect x="50" y="26" width="28" height="7" rx="3.5" fill="#27272a" />
      <rect x="84" y="26" width="28" height="7" rx="3.5" fill="#27272a" />
      {/* Cards — col 1 */}
      <rect x="16" y="38" width="28" height="14" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
      <rect x="20" y="42" width="14" height="2" rx="1" fill="#52525b" />
      <rect x="20" y="46" width="10" height="2" rx="1" fill="#3f3f46" />
      <rect x="16" y="56" width="28" height="14" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
      <rect x="20" y="60" width="18" height="2" rx="1" fill="#52525b" />
      <rect x="20" y="64" width="12" height="2" rx="1" fill="#3f3f46" />
      {/* Cards — col 2 */}
      <rect x="50" y="38" width="28" height="14" rx="4" fill="#27272a" stroke="#6366f1" strokeWidth="1" opacity="0.7" />
      <rect x="54" y="42" width="16" height="2" rx="1" fill="#6366f1" opacity="0.6" />
      <rect x="54" y="46" width="11" height="2" rx="1" fill="#4f46e5" opacity="0.4" />
      {/* Card — col 3 (dashed/empty) */}
      <rect x="84" y="38" width="28" height="14" rx="4" fill="none" stroke="#3f3f46" strokeWidth="1" strokeDasharray="3 2" />
      {/* Plus icon hinting empty col 3 */}
      <line x1="98" y1="43" x2="98" y2="49" stroke="#3f3f46" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="95" y1="46" x2="101" y2="46" stroke="#3f3f46" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ChartIllustration() {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-20">
      {/* Axes */}
      <line x1="20" y1="16" x2="20" y2="72" stroke="#3f3f46" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="72" x2="104" y2="72" stroke="#3f3f46" strokeWidth="1.5" strokeLinecap="round" />
      {/* Bars */}
      <rect x="30" y="54" width="14" height="18" rx="3" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
      <rect x="50" y="44" width="14" height="28" rx="3" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
      <rect x="70" y="34" width="14" height="38" rx="3" fill="#3730a3" opacity="0.4" stroke="#6366f1" strokeWidth="1" />
      <rect x="90" y="40" width="14" height="32" rx="3" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
      {/* Trend line dashed */}
      <polyline points="37,54 57,44 77,32 97,38" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" opacity="0.5" />
      {/* Dots on trend */}
      <circle cx="37" cy="54" r="2.5" fill="#6366f1" opacity="0.6" />
      <circle cx="77" cy="32" r="2.5" fill="#6366f1" opacity="0.8" />
      {/* Y-axis ticks */}
      <line x1="17" y1="54" x2="20" y2="54" stroke="#3f3f46" strokeWidth="1" />
      <line x1="17" y1="36" x2="20" y2="36" stroke="#3f3f46" strokeWidth="1" />
    </svg>
  )
}

function SearchIllustration() {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-20">
      {/* Magnifying glass */}
      <circle cx="52" cy="42" r="22" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
      <circle cx="52" cy="42" r="15" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
      {/* Lines inside glass (search result lines) */}
      <line x1="42" y1="38" x2="62" y2="38" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />
      <line x1="42" y1="43" x2="58" y2="43" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />
      <line x1="42" y1="48" x2="55" y2="48" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />
      {/* Handle */}
      <line x1="69" y1="58" x2="82" y2="72" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" />
      {/* X mark inside glass */}
      <line x1="47" y1="37" x2="57" y2="47" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="57" y1="37" x2="47" y2="47" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

function CheckIllustration() {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-20">
      {/* Circle */}
      <circle cx="60" cy="44" r="28" fill="#18181b" stroke="#27272a" strokeWidth="2" />
      <circle cx="60" cy="44" r="28" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="8 4" opacity="0.4" />
      {/* Checkmark */}
      <path d="M46 44 L56 54 L74 34" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Small sparkles */}
      <circle cx="28" cy="22" r="2" fill="#10b981" opacity="0.3" />
      <circle cx="92" cy="26" r="1.5" fill="#10b981" opacity="0.2" />
      <circle cx="96" cy="62" r="2" fill="#10b981" opacity="0.25" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

const ILLUSTRATIONS = {
  telescope: TelescopeIllustration,
  kanban: KanbanIllustration,
  chart: ChartIllustration,
  search: SearchIllustration,
  check: CheckIllustration,
}

export type EmptyStateVariant = keyof typeof ILLUSTRATIONS

interface EmptyStateProps {
  variant: EmptyStateVariant
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  variant,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  const Illustration = ILLUSTRATIONS[variant]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col items-center justify-center text-center gap-4 select-none ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <Illustration />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        className="space-y-1.5"
      >
        <p className="text-sm font-semibold text-zinc-300">{title}</p>
        {description && (
          <p className="text-xs text-zinc-600 leading-relaxed max-w-[260px]">{description}</p>
        )}
      </motion.div>

      {(action || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="flex items-center gap-2"
        >
          {action && (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              {action.icon}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
