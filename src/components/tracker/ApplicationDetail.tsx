'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { ApplicationWithJob, ApplicationStatus, TimelineEntry } from '@/lib/jobs/types'

interface ApplicationDetailProps {
  app: ApplicationWithJob | null
  onClose: () => void
  onStatusChange: (appId: string, newStatus: ApplicationStatus) => void
  onUpdate: (appId: string, patch: Partial<ApplicationWithJob>) => void
  onDelete: (appId: string) => void
  onArchive: (appId: string, archived: boolean) => void
}

const STATUS_SEQUENCE: ApplicationStatus[] = [
  'saved', 'applied', 'phone_screen', 'technical', 'final', 'offer', 'rejected',
]

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  technical: 'Technical',
  final: 'Final Round',
  offer: 'Offer',
  rejected: 'Rejected',
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  saved: 'bg-zinc-700 text-zinc-300 border-zinc-600',
  applied: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  phone_screen: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  technical: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  final: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  offer: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => `$${n.toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)} / yr`
  if (min) return `${fmt(min)}+ / yr`
  return `Up to ${fmt(max!)} / yr`
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function ApplicationDetail({ app, onClose, onStatusChange, onUpdate, onDelete, onArchive }: ApplicationDetailProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [recruiterName, setRecruiterName] = useState('')
  const [recruiterEmail, setRecruiterEmail] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const prevAppId = useRef<string | null>(null)

  const debouncedName = useDebounce(recruiterName, 800)
  const debouncedEmail = useDebounce(recruiterEmail, 800)

  // Load timeline + reset recruiter fields when app changes
  useEffect(() => {
    if (!app) return
    if (app.id === prevAppId.current) return
    prevAppId.current = app.id

    setRecruiterName(app.recruiter_name ?? '')
    setRecruiterEmail(app.recruiter_email ?? '')
    setDeleteState('idle')
    setTimeline([])

    fetch(`/api/applications/${app.id}`)
      .then((r) => r.json())
      .then((d: { timeline: TimelineEntry[] }) => setTimeline(d.timeline ?? []))
      .catch(() => {})
  }, [app])

  // Auto-save recruiter fields
  useEffect(() => {
    if (!app) return
    if (debouncedName === (app.recruiter_name ?? '') && debouncedEmail === (app.recruiter_email ?? '')) return
    saveField({ recruiter_name: debouncedName, recruiter_email: debouncedEmail })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedName, debouncedEmail])

  const saveField = useCallback(async (patch: Record<string, unknown>) => {
    if (!app) return
    setSaveState('saving')
    try {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 1500)
      }
    } catch {
      setSaveState('idle')
    }
  }, [app])

  const handleNotesUpdate = useCallback(async (notes: Record<string, unknown>) => {
    if (!app) return
    onUpdate(app.id, { notes })
    await saveField({ notes })
  }, [app, saveField, onUpdate])

  async function handleArchive() {
    if (!app) return
    const newArchived = !app.is_archived
    onArchive(app.id, newArchived)
    await fetch(`/api/applications/${app.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: newArchived }),
    })
  }

  async function handleDelete() {
    if (!app) return
    if (deleteState === 'idle') {
      setDeleteState('confirm')
      // Auto-reset confirm state after 3s if not acted on
      setTimeout(() => setDeleteState((s) => s === 'confirm' ? 'idle' : s), 3000)
      return
    }
    if (deleteState === 'confirm') {
      setDeleteState('deleting')
      await fetch(`/api/applications/${app.id}`, { method: 'DELETE' })
      onDelete(app.id)
    }
  }

  async function handleStatusChange(newStatus: ApplicationStatus) {
    if (!app || newStatus === app.status) return
    onStatusChange(app.id, newStatus)
    const res = await fetch(`/api/applications/${app.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      // Refresh timeline
      const d = await fetch(`/api/applications/${app.id}`).then((r) => r.json()) as { timeline: TimelineEntry[] }
      setTimeline(d.timeline ?? [])
    }
  }

  return (
    <AnimatePresence>
      {app && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-800 z-30 flex flex-col overflow-hidden lg:relative lg:top-auto lg:right-auto lg:h-auto lg:max-w-none lg:border-l lg:z-auto"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-zinc-800 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-zinc-100 leading-snug truncate">{app.jobs.title}</h2>
                <p className="text-sm text-zinc-400 mt-0.5">{app.jobs.company}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                {saveState !== 'idle' && (
                  <span className={`text-[11px] transition-opacity ${saveState === 'saved' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {saveState === 'saving' ? 'Saving…' : 'Saved'}
                  </span>
                )}
                <button
                  onClick={handleArchive}
                  className={`transition-colors ${app.is_archived ? 'text-amber-400 hover:text-zinc-400' : 'text-zinc-600 hover:text-amber-400'}`}
                  aria-label={app.is_archived ? 'Unarchive' : 'Archive'}
                  title={app.is_archived ? 'Unarchive' : 'Archive'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteState === 'deleting'}
                  className={`text-xs px-2 py-0.5 rounded transition-all disabled:opacity-50 ${
                    deleteState === 'confirm'
                      ? 'text-red-400 border border-red-500/50 bg-red-500/10'
                      : 'text-zinc-600 hover:text-red-400 transition-colors'
                  }`}
                  aria-label="Delete application"
                  title={deleteState === 'confirm' ? 'Click again to confirm' : 'Delete application'}
                >
                  {deleteState === 'confirm' ? 'Confirm?' : deleteState === 'deleting' ? '…' : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Meta */}
              <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                {app.jobs.location && <span>📍 {app.jobs.location}</span>}
                {app.jobs.is_remote && <span>🌐 Remote</span>}
                {formatSalary(app.jobs.salary_min, app.jobs.salary_max) && (
                  <span>💰 {formatSalary(app.jobs.salary_min, app.jobs.salary_max)}</span>
                )}
                {app.applied_at && <span>📅 Applied {formatDate(app.applied_at)}</span>}
                {app.jobs.url && (
                  <a
                    href={app.jobs.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
                  >
                    View listing ↗
                  </a>
                )}
              </div>

              {/* Status buttons */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</h3>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_SEQUENCE.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`
                        text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all
                        ${app.status === s
                          ? STATUS_COLORS[s]
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500 hover:text-zinc-300'
                        }
                      `}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recruiter */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Recruiter</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={recruiterName}
                    onChange={(e) => setRecruiterName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={recruiterEmail}
                    onChange={(e) => setRecruiterEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Notes</h3>
                <NotesEditor
                  initialContent={app.notes}
                  onUpdate={handleNotesUpdate}
                />
              </div>

              {/* Timeline */}
              {timeline.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Timeline</h3>
                  <div className="space-y-2">
                    {timeline.map((entry, i) => (
                      <div key={entry.id} className="flex gap-3 items-start">
                        <div className="relative flex flex-col items-center">
                          <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                            i === timeline.length - 1 ? 'bg-zinc-300' : 'bg-zinc-600'
                          }`} />
                          {i < timeline.length - 1 && (
                            <div className="w-px flex-1 bg-zinc-800 mt-1 min-h-[16px]" />
                          )}
                        </div>
                        <div className="pb-2 min-w-0">
                          <p className="text-xs text-zinc-300">
                            {entry.from_status
                              ? `${STATUS_LABELS[entry.from_status as ApplicationStatus] ?? entry.from_status} → ${STATUS_LABELS[entry.to_status as ApplicationStatus] ?? entry.to_status}`
                              : `Marked as ${STATUS_LABELS[entry.to_status as ApplicationStatus] ?? entry.to_status}`
                            }
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-0.5">{formatDate(entry.changed_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Notes Editor ─────────────────────────────────────────────────────────────

interface NotesEditorProps {
  initialContent: Record<string, unknown> | null
  onUpdate: (notes: Record<string, unknown>) => void
}

function NotesEditor({ initialContent, onUpdate }: NotesEditorProps) {
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  const editor = useEditor({
    extensions: [StarterKit],
    content: (initialContent as object) ?? '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onUpdateRef.current(editor.getJSON() as Record<string, unknown>)
    },
  })

  return (
    <div
      className="relative min-h-[100px] rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-300 focus-within:border-zinc-600 transition-colors cursor-text"
      onClick={() => editor?.commands.focus()}
    >
      {!editor?.getText() && (
        <p className="absolute top-2.5 left-3 text-zinc-600 text-sm pointer-events-none select-none">
          Add notes…
        </p>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-invert prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[80px]"
      />
    </div>
  )
}
