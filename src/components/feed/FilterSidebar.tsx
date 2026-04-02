'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DateRange, FeedFilters } from '@/lib/jobs/types'

interface FilterSidebarProps {
  filters: FeedFilters
  onChange: (filters: FeedFilters) => void
}

const EXPERIENCE_LEVELS = [
  { value: '', label: 'Any level' },
  { value: 'entry', label: 'Entry level' },
  { value: 'mid', label: 'Mid level' },
  { value: 'senior', label: 'Senior' },
]

const ROLE_TYPES = [
  { value: '', label: 'Any type' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' },
]

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: '', label: 'All time' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '1y', label: '1 year' },
]

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const [isOpen, setIsOpen] = useState(true)

  function update(patch: Partial<FeedFilters>) {
    onChange({ ...filters, ...patch })
  }

  function reset() {
    onChange({ location: '', isRemote: 'all', country: 'all', salaryMin: '', experienceLevel: '', roleType: '', dateRange: '' })
  }

  const hasActiveFilters =
    filters.location ||
    filters.isRemote !== 'all' ||
    filters.country !== 'all' ||
    filters.salaryMin ||
    filters.experienceLevel ||
    filters.roleType ||
    filters.dateRange

  return (
    <div className="space-y-1">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-1 py-1 text-xs font-semibold text-zinc-400 uppercase tracking-wide hover:text-zinc-300 transition-colors"
      >
        <span>Filters</span>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={(e) => { e.stopPropagation(); reset() }}
              className="text-[10px] font-normal lowercase text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              clear
            </button>
          )}
          <motion.svg
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-2 pb-1">
              {/* Remote toggle */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-500 font-medium">Work type</label>
                <div className="flex gap-1">
                  {(['all', 'remote', 'onsite'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => update({ isRemote: opt })}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        filters.isRemote === opt
                          ? 'bg-zinc-700 text-zinc-100'
                          : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {opt === 'all' ? 'All' : opt === 'remote' ? 'Remote' : 'On-site'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-500 font-medium">Country</label>
                <div className="flex gap-1">
                  {(['all', 'us', 'international'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => update({ country: opt })}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        filters.country === opt
                          ? 'bg-zinc-700 text-zinc-100'
                          : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {opt === 'all' ? 'Any' : opt === 'us' ? 'US' : 'Intl'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-500 font-medium">Location</label>
                <input
                  type="text"
                  value={filters.location}
                  onChange={(e) => update({ location: e.target.value })}
                  placeholder="City, state…"
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              {/* Salary min */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-500 font-medium">Min salary</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                  <input
                    type="number"
                    value={filters.salaryMin}
                    onChange={(e) => update({ salaryMin: e.target.value })}
                    placeholder="80000"
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 pl-6 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>
              </div>

              {/* Experience level */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-500 font-medium">Experience</label>
                <div className="grid grid-cols-2 gap-1">
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <button
                      key={lvl.value}
                      onClick={() => update({ experienceLevel: lvl.value })}
                      className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                        filters.experienceLevel === lvl.value
                          ? 'bg-zinc-700 text-zinc-100'
                          : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Role type */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-500 font-medium">Role type</label>
                <div className="grid grid-cols-2 gap-1">
                  {ROLE_TYPES.map((rt) => (
                    <button
                      key={rt.value}
                      onClick={() => update({ roleType: rt.value })}
                      className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                        filters.roleType === rt.value
                          ? 'bg-zinc-700 text-zinc-100'
                          : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-500 font-medium">Posted</label>
                <div className="grid grid-cols-2 gap-1">
                  {DATE_RANGES.map((dr) => (
                    <button
                      key={dr.value}
                      onClick={() => update({ dateRange: dr.value })}
                      className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                        filters.dateRange === dr.value
                          ? 'bg-zinc-700 text-zinc-100'
                          : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {dr.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
