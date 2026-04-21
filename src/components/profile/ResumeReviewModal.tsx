'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ResumeAnalysis } from '@/lib/llm/resume-analyzer'

interface Props {
  analysis: ResumeAnalysis
  onConfirm: (result: CommitResult) => void
  onDismiss: () => void
}

interface CommitResult {
  skills_extracted: string[]
  answers_generated: number
  work_history_added: number
  education_added: number
  profile_fields_filled: string[]
}

export function ResumeReviewModal({ analysis, onConfirm, onDismiss }: Props) {
  const [approveSkills, setApproveSkills] = useState(true)
  const [approvePersonalInfo, setApprovePersonalInfo] = useState(true)
  const [approvedWork, setApprovedWork] = useState<Set<number>>(
    new Set(analysis.work_history.map((_, i) => i))
  )
  const [approvedEdu, setApprovedEdu] = useState<Set<number>>(
    new Set(analysis.education.map((_, i) => i))
  )
  const [approvedQA, setApprovedQA] = useState<Set<number>>(
    new Set(analysis.qa_pairs.map((_, i) => i))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleWork(i: number) {
    setApprovedWork(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }
  function toggleEdu(i: number) {
    setApprovedEdu(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }
  function toggleQA(i: number) {
    setApprovedQA(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/resume/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          approved: {
            skills: approveSkills,
            personal_info: approvePersonalInfo,
            work_history: Array.from(approvedWork),
            education: Array.from(approvedEdu),
            qa_pairs: Array.from(approvedQA),
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        setError(err.error ?? 'Save failed')
        return
      }
      const result = await res.json() as CommitResult
      onConfirm(result)
    } catch {
      setError('Save failed — please try again')
    } finally {
      setSaving(false)
    }
  }

  const hasPersonalInfo = Object.values(analysis.personal_info).some(v => v !== null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70"
        onClick={onDismiss}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Review extracted data</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Uncheck anything you don&apos;t want saved</p>
          </div>
          <button
            onClick={onDismiss}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Personal info */}
          {hasPersonalInfo && (
            <Section
              label="Personal info"
              checked={approvePersonalInfo}
              onToggle={() => setApprovePersonalInfo(v => !v)}
            >
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-400">
                {analysis.personal_info.full_name && <span>Name: <span className="text-zinc-200">{analysis.personal_info.full_name}</span></span>}
                {analysis.personal_info.phone && <span>Phone: <span className="text-zinc-200">{analysis.personal_info.phone}</span></span>}
                {analysis.personal_info.address && <span>Address: <span className="text-zinc-200">{analysis.personal_info.address}</span></span>}
                {analysis.personal_info.linkedin_url && <span>LinkedIn: <span className="text-zinc-200">{analysis.personal_info.linkedin_url}</span></span>}
                {analysis.personal_info.github_url && <span>GitHub: <span className="text-zinc-200">{analysis.personal_info.github_url}</span></span>}
                {analysis.personal_info.portfolio_url && <span>Portfolio: <span className="text-zinc-200">{analysis.personal_info.portfolio_url}</span></span>}
              </div>
            </Section>
          )}

          {/* Skills */}
          {analysis.skills.length > 0 && (
            <Section
              label={`Skills (${analysis.skills.length})`}
              checked={approveSkills}
              onToggle={() => setApproveSkills(v => !v)}
            >
              <div className="flex flex-wrap gap-1.5">
                {analysis.skills.map(s => (
                  <span key={s} className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Work history */}
          {analysis.work_history.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Work history ({analysis.work_history.length})
              </p>
              {analysis.work_history.map((entry, i) => (
                <ToggleRow
                  key={i}
                  checked={approvedWork.has(i)}
                  onToggle={() => toggleWork(i)}
                >
                  <div>
                    <p className="text-sm text-zinc-200">{entry.title} <span className="text-zinc-500">at</span> {entry.company}</p>
                    <p className="text-xs text-zinc-500">
                      {entry.start_date ?? '?'} – {entry.is_current ? 'Present' : (entry.end_date ?? '?')}
                    </p>
                    {entry.description && (
                      <p className="text-xs text-zinc-500 mt-1 whitespace-pre-line line-clamp-3">
                        {entry.description}
                      </p>
                    )}
                  </div>
                </ToggleRow>
              ))}
            </div>
          )}

          {/* Education */}
          {analysis.education.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Education ({analysis.education.length})
              </p>
              {analysis.education.map((entry, i) => (
                <ToggleRow
                  key={i}
                  checked={approvedEdu.has(i)}
                  onToggle={() => toggleEdu(i)}
                >
                  <div>
                    <p className="text-sm text-zinc-200">{entry.school}</p>
                    <p className="text-xs text-zinc-500">
                      {[entry.degree, entry.field_of_study].filter(Boolean).join(' · ')}
                      {entry.graduation_year ? ` · ${entry.graduation_year}` : ''}
                      {entry.gpa ? ` · GPA ${entry.gpa}` : ''}
                    </p>
                  </div>
                </ToggleRow>
              ))}
            </div>
          )}

          {/* Q&A pairs */}
          {analysis.qa_pairs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Saved answers ({analysis.qa_pairs.length})
              </p>
              {analysis.qa_pairs.map((pair, i) => (
                <ToggleRow
                  key={i}
                  checked={approvedQA.has(i)}
                  onToggle={() => toggleQA(i)}
                >
                  <div>
                    <p className="text-xs font-medium text-zinc-300">{pair.question}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{pair.answer}</p>
                  </div>
                </ToggleRow>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between gap-3">
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium bg-zinc-100 text-zinc-900 rounded-lg hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </>
              ) : 'Confirm & Save'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Section({
  label,
  checked,
  onToggle,
  children,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 accent-zinc-200"
        />
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</span>
      </label>
      <AnimatePresence>
        {checked && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-5 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ToggleRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        checked
          ? 'border-zinc-700 bg-zinc-800/40'
          : 'border-zinc-800 bg-zinc-900 opacity-50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 accent-zinc-200 shrink-0"
      />
      <div className="flex-1 min-w-0">{children}</div>
    </label>
  )
}
