'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Combobox, type Suggestion } from '@/components/ui/Combobox'
import type { ApplicationWithJob, ApplicationStatus } from '@/lib/jobs/types'

interface ExtractedJobData {
  title: string
  company: string
  location: string | null
  url: string
  salary_min: number | null
  salary_max: number | null
  description: string | null
  tags: string[] | null
  is_remote: boolean
  experience_level: string | null
}

interface LogApplicationModalProps {
  onSuccess: (application: ApplicationWithJob) => void
  onClose: () => void
}

const STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'phone_screen', label: 'Phone Screen' },
  { value: 'technical', label: 'Technical' },
  { value: 'final', label: 'Final Round' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
]

function todayISO() {
  return new Date().toISOString().split('T')[0]!
}

export function LogApplicationModal({ onSuccess, onClose }: LogApplicationModalProps) {
  const [step, setStep] = useState<'entry' | 'form'>('entry')
  const [urlInput, setUrlInput] = useState('')
  const [extractState, setExtractState] = useState<'idle' | 'loading' | 'error' | 'js-rendered'>('idle')
  const [extractError, setExtractError] = useState('')
  const [hasDescription, setHasDescription] = useState(false)

  // Form fields
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<ApplicationStatus>('applied')
  const [appliedDate, setAppliedDate] = useState(todayISO)
  const [notes, setNotes] = useState('')

  // Hidden extraction fields passed through to API
  const [extractedPayload, setExtractedPayload] = useState<Partial<ExtractedJobData>>({})

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const fetchCompanySuggestions = useCallback(async (q: string): Promise<Suggestion[]> => {
    try {
      const res = await fetch(`/api/autocomplete/companies?q=${encodeURIComponent(q)}`)
      if (!res.ok) return []
      const data = await res.json() as { suggestions: Suggestion[] }
      return data.suggestions ?? []
    } catch {
      return []
    }
  }, [])

  const fetchLocationSuggestions = useCallback(async (q: string): Promise<Suggestion[]> => {
    try {
      const res = await fetch(`/api/autocomplete/locations?q=${encodeURIComponent(q)}`)
      if (!res.ok) return []
      const data = await res.json() as { suggestions: Suggestion[] }
      return data.suggestions ?? []
    } catch {
      return []
    }
  }, [])

  async function handleExtract() {
    const u = urlInput.trim()
    if (!u || extractState === 'loading') return
    setExtractState('loading')
    setExtractError('')
    try {
      const res = await fetch('/api/jobs/manual/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      })
      const data = await res.json() as { job?: ExtractedJobData; error?: string; jsRendered?: boolean }

      if (res.ok && data.job) {
        const j = data.job
        setCompany(j.company ?? '')
        setTitle(j.title ?? '')
        setLocation(j.location ?? '')
        setUrl(j.url ?? u)
        setHasDescription(!!j.description)
        setExtractedPayload({
          description: j.description,
          tags: j.tags,
          is_remote: j.is_remote,
          experience_level: j.experience_level,
          salary_min: j.salary_min,
          salary_max: j.salary_max,
        })
        setExtractState('idle')
        setStep('form')
      } else if (res.status === 422 && data.jsRendered) {
        setExtractState('js-rendered')
        setExtractError('This page requires JavaScript to load. Enter the details manually instead.')
      } else {
        setExtractState('error')
        setExtractError(data.error ?? 'Could not extract job details.')
      }
    } catch {
      setExtractState('error')
      setExtractError('Could not reach server.')
    }
  }

  function handleSkipToManual() {
    setUrl(urlInput.trim())
    setHasDescription(false)
    setExtractedPayload({})
    setExtractState('idle')
    setExtractError('')
    setStep('form')
  }

  function handleBack() {
    setStep('entry')
    setSaveError('')
  }

  async function handleSave() {
    if (!company.trim() || !title.trim() || saving) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/jobs/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(),
          title: title.trim(),
          location: location.trim() || null,
          url: url.trim() || null,
          applied_date: appliedDate,
          status,
          notes: notes.trim() || null,
          ...extractedPayload,
        }),
      })
      const data = await res.json() as { application?: ApplicationWithJob; error?: string }
      if (res.ok && data.application) {
        onSuccess(data.application)
      } else {
        setSaveError(data.error ?? 'Failed to save application.')
      }
    } catch {
      setSaveError('Could not reach server.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors'
  const labelClass = 'block text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            {step === 'form' && (
              <button
                onClick={handleBack}
                className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-sm font-semibold text-zinc-100">Log Application</h2>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait" initial={false}>
          {step === 'entry' ? (
            <motion.div
              key="entry"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="px-5 py-5 space-y-4"
            >
              <p className="text-xs text-zinc-400 leading-relaxed">
                Paste a job URL and we&apos;ll fill in the details automatically, or skip to enter everything by hand.
              </p>

              <div className="relative">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value)
                    if (extractState !== 'idle') setExtractState('idle')
                    setExtractError('')
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleExtract() }}
                  placeholder="https://jobs.lever.co/…"
                  autoFocus
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 pr-20 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                />
                <button
                  onClick={() => void handleExtract()}
                  disabled={!urlInput.trim() || extractState === 'loading'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-700 text-xs text-zinc-300 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {extractState === 'loading' ? (
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : 'Extract'}
                </button>
              </div>

              <AnimatePresence>
                {(extractState === 'error' || extractState === 'js-rendered') && extractError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-red-400"
                  >
                    {extractError}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[11px] text-zinc-600">or</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <button
                onClick={handleSkipToManual}
                className="w-full py-2 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
              >
                Enter details manually
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex flex-col"
            >
              <div className="px-5 py-5 space-y-3.5 overflow-y-auto max-h-[60vh]">
                {/* Company + Title */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      Company <span className="text-red-400 normal-case font-normal">*</span>
                    </label>
                    <Combobox
                      value={company}
                      onChange={setCompany}
                      fetchSuggestions={fetchCompanySuggestions}
                      placeholder="Stripe"
                      inputClassName={inputClass}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Title <span className="text-red-400 normal-case font-normal">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Software Engineer"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className={labelClass}>Location</label>
                  <Combobox
                    value={location}
                    onChange={setLocation}
                    fetchSuggestions={fetchLocationSuggestions}
                    placeholder="Remote · New York, NY"
                    inputClassName={inputClass}
                  />
                </div>

                {/* Job URL */}
                <div>
                  <label className={labelClass}>Job URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://… (optional)"
                    className={inputClass}
                  />
                </div>

                {/* Status + Applied date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                      className={inputClass}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Applied date</label>
                    <input
                      type="date"
                      value={appliedDate}
                      onChange={(e) => setAppliedDate(e.target.value)}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Referred by…, applied via LinkedIn, recruiter name…"
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {/* Extraction status banner */}
                {hasDescription ? (
                  <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
                    <svg className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[11px] text-emerald-400 leading-relaxed">
                      Job description extracted — match scoring and interview prep will be available.
                    </p>
                  </div>
                ) : url ? (
                  <div className="flex items-start gap-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-2.5">
                    <svg className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      No description extracted. Match scoring and prep won&apos;t be available until a description is added.
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between shrink-0">
                {saveError ? (
                  <p className="text-xs text-red-400">{saveError}</p>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={!company.trim() || !title.trim() || saving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving && (
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    )}
                    {saving ? 'Saving…' : 'Save Application'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
