'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DateRange, FeedFilters, SavedFilterPreset } from '@/lib/jobs/types'
import { useToast } from '@/components/ui/Toaster'

interface FilterSidebarProps {
  filters: FeedFilters
  onChange: (filters: FeedFilters) => void
  onFocusRef?: React.MutableRefObject<(() => void) | null>
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

const EMPTY_FILTERS: FeedFilters = {
  search: '',
  location: '',
  isRemote: 'all',
  country: 'all',
  salaryMin: '',
  experienceLevel: '',
  roleType: '',
  dateRange: '',
}

function stripVersion(filters: SavedFilterPreset['filters']): FeedFilters {
  return {
    search: filters.search,
    location: filters.location,
    isRemote: filters.isRemote,
    country: filters.country,
    salaryMin: filters.salaryMin,
    experienceLevel: filters.experienceLevel,
    roleType: filters.roleType,
    dateRange: filters.dateRange,
  }
}

function sameFilters(a: FeedFilters, b: FeedFilters): boolean {
  return (
    a.location === b.location &&
    a.search === b.search &&
    a.isRemote === b.isRemote &&
    a.country === b.country &&
    a.salaryMin === b.salaryMin &&
    a.experienceLevel === b.experienceLevel &&
    a.roleType === b.roleType &&
    a.dateRange === b.dateRange
  )
}

export function FilterSidebar({ filters, onChange, onFocusRef }: FilterSidebarProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(true)
  const [presets, setPresets] = useState<SavedFilterPreset[]>([])
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [saving, setSaving] = useState(false)
  const locationRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (onFocusRef) {
      onFocusRef.current = () => {
        setIsOpen(true)
        setTimeout(() => locationRef.current?.focus(), 50)
      }
    }
  }, [onFocusRef])

  function update(patch: Partial<FeedFilters>) {
    onChange({ ...filters, ...patch })
  }

  function reset() {
    onChange(EMPTY_FILTERS)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/filter-presets')
      .then((res) => (res.ok ? (res.json() as Promise<{ presets: SavedFilterPreset[] }>) : null))
      .then((data) => {
        if (!cancelled && data) setPresets(data.presets)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activePresetId) return
    const activePreset = presets.find((preset) => preset.id === activePresetId)
    if (!activePreset || !sameFilters(filters, stripVersion(activePreset.filters))) {
      setActivePresetId(null)
    }
  }, [activePresetId, filters, presets])

  function applyPreset(preset: SavedFilterPreset) {
    if (preset.id === activePresetId) {
      setActivePresetId(null)
      onChange(EMPTY_FILTERS)
      return
    }

    setActivePresetId(preset.id)
    onChange(stripVersion(preset.filters))
  }

  async function deletePreset(id: string) {
    const previous = presets
    setPresets((current) => current.filter((preset) => preset.id !== id))
    if (activePresetId === id) setActivePresetId(null)

    try {
      const res = await fetch(`/api/filter-presets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
    } catch {
      setPresets(previous)
      toast({ type: 'error', title: 'Could not delete preset' })
    }
  }

  async function savePreset() {
    const name = presetName.trim()
    if (!name || saving || presets.length >= 20) return
    setSaving(true)
    try {
      const res = await fetch('/api/filter-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters: { version: 1, ...filters } }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'save failed')

      const preset = data as SavedFilterPreset
      setPresets((current) => [preset, ...current])
      setActivePresetId(preset.id)
      setPresetName('')
      setSaveOpen(false)
      toast({ type: 'success', title: 'Preset saved', description: name })
    } catch (err) {
      toast({
        type: 'error',
        title: 'Could not save preset',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const hasActiveFilters =
    filters.search ||
    filters.location ||
    filters.isRemote !== 'all' ||
    filters.country !== 'all' ||
    filters.salaryMin ||
    filters.experienceLevel ||
    filters.roleType ||
    filters.dateRange

  const atPresetLimit = presets.length >= 20

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
              <div className="space-y-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center justify-between gap-2">
                  {presets.length > 0 ? (
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide px-1 py-1">
                      Saved Presets
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-600 px-1 py-1.5">No saved presets yet</p>
                  )}
                  {presets.length >= 10 && (
                    <span className="text-[10px] text-zinc-600">{presets.length} / 20</span>
                  )}
                </div>

                {presets.length > 0 && (
                  <div role="group" aria-label="Saved filter presets" className="flex flex-wrap gap-1.5">
                    {presets.map((preset) => {
                      const active = preset.id === activePresetId
                      return (
                        <div key={preset.id} className="group relative inline-flex items-center">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => applyPreset(preset)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                applyPreset(preset)
                              }
                            }}
                            className={`max-w-[10rem] truncate rounded-full border text-[11px] py-1 pl-2.5 pr-6 transition-colors ${
                              active
                                ? 'border-blue-500/40 bg-blue-500/15 text-blue-400'
                                : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                            }`}
                            title={preset.name}
                          >
                            {preset.name}
                          </span>
                          <button
                            type="button"
                            aria-label={`Delete preset ${preset.name}`}
                            onClick={() => void deletePreset(preset.id)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 -m-1 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100 focus:opacity-100"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                <button
                  type="button"
                  disabled={atPresetLimit}
                  title={atPresetLimit ? "You've reached the 20 preset limit — delete a preset to save a new one" : undefined}
                  onClick={() => setSaveOpen(true)}
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    atPresetLimit
                      ? 'cursor-not-allowed opacity-40 border-zinc-800 bg-zinc-900 text-zinc-600'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
                  }`}
                >
                  Save current filters
                </button>
              </div>

              {/* Search */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-500 font-medium">Search</label>
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => update({ search: e.target.value })}
                  placeholder="Title or company..."
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

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
                  ref={locationRef}
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

      <AnimatePresence>
        {saveOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-preset-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-xl"
            >
              <div className="space-y-3">
                <div>
                  <h2 id="save-preset-title" className="text-sm font-semibold text-zinc-100">
                    Save Filter Preset
                  </h2>
                </div>
                <input
                  autoFocus
                  value={presetName}
                  maxLength={50}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void savePreset()
                    if (e.key === 'Escape') setSaveOpen(false)
                  }}
                  placeholder="Preset name"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-600">{presetName.trim().length} / 50</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSaveOpen(false)}
                      className="rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!presetName.trim() || saving}
                      onClick={() => void savePreset()}
                      className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
