'use client'

import { useState, useEffect, useRef } from 'react'

type Template = 'formal' | 'casual' | 'startup'

interface CoverLetterData {
  id: string
  template_type: Template
  content: string
}

interface CoverLetterSectionProps {
  jobId: string
}

const TEMPLATE_LABELS: Record<Template, string> = {
  formal: 'Formal',
  casual: 'Casual',
  startup: 'Startup',
}

const TEMPLATE_DESCRIPTIONS: Record<Template, string> = {
  formal: 'Traditional & structured',
  casual: 'Warm & conversational',
  startup: 'Direct & energetic',
}

export function CoverLetterSection({ jobId }: CoverLetterSectionProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [letter, setLetter] = useState<CoverLetterData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template>('casual')
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load existing cover letter when job changes
  useEffect(() => {
    setLetter(null)
    setState('idle')
    setEditing(false)
    setError(null)
    fetch(`/api/cover-letter?job_id=${jobId}`)
      .then(r => r.json())
      .then((data: CoverLetterData | null) => {
        if (data?.content) {
          setLetter(data)
          setSelectedTemplate(data.template_type)
          setDraftContent(data.content)
          setState('done')
        }
      })
      .catch(() => {})
  }, [jobId])

  // Auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [editing, draftContent])

  async function handleGenerate() {
    if (state === 'loading') return
    setState('loading')
    setError(null)
    try {
      const res = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, template_type: selectedTemplate }),
      })
      if (res.ok) {
        const data = await res.json() as CoverLetterData
        setLetter(data)
        setSelectedTemplate(data.template_type)
        setDraftContent(data.content)
        setState('done')
      } else {
        const err = await res.json() as { error: string }
        setError(err.error ?? 'Generation failed')
        setState('error')
      }
    } catch {
      setError('Something went wrong — please try again')
      setState('error')
    }
  }

  async function handleSaveEdit() {
    if (!letter) return
    setSaveState('saving')
    try {
      const res = await fetch(`/api/cover-letter/${letter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draftContent }),
      })
      if (res.ok) {
        const updated = await res.json() as CoverLetterData
        setLetter(prev => prev ? { ...prev, content: updated.content } : prev)
        setSaveState('saved')
        setEditing(false)
        setTimeout(() => setSaveState('idle'), 2000)
      } else {
        setSaveState('idle')
      }
    } catch {
      setSaveState('idle')
    }
  }

  async function handleCopy() {
    const text = editing ? draftContent : (letter?.content ?? '')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLoading = state === 'loading'

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cover Letter</h3>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-3">

        {state === 'done' && letter ? (
          <>
            {/* Template badge + actions */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium">
                  {TEMPLATE_LABELS[letter.template_type]}
                </span>
                <span className="text-xs text-zinc-500">{TEMPLATE_DESCRIPTIONS[letter.template_type]}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopy}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                {!editing && (
                  <a
                    href={`/api/cover-letter/${letter.id}/pdf`}
                    download="cover-letter.pdf"
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
                  >
                    Download PDF
                  </a>
                )}
                {!editing && (
                  <button
                    onClick={() => {
                      setDraftContent(letter.content)
                      setEditing(true)
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* Letter content */}
            {editing ? (
              <div className="space-y-2">
                <textarea
                  ref={textareaRef}
                  value={draftContent}
                  onChange={e => setDraftContent(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 leading-relaxed resize-none focus:outline-none focus:border-zinc-500 transition-colors min-h-[200px]"
                  spellCheck
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saveState === 'saving'}
                    className="flex-1 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors disabled:opacity-50"
                  >
                    {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved!' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => {
                      setDraftContent(letter.content)
                      setEditing(false)
                    }}
                    className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                {letter.content}
              </div>
            )}

            {/* Re-generate row */}
            {!editing && (
              <div className="pt-1 border-t border-zinc-800 flex items-center gap-2">
                <div className="flex gap-1">
                  {(['formal', 'casual', 'startup'] as Template[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedTemplate(t)}
                      className={`text-xs px-2 py-0.5 rounded transition-colors ${
                        selectedTemplate === t
                          ? 'bg-zinc-700 text-zinc-200'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {TEMPLATE_LABELS[t]}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                >
                  Re-generate
                </button>
              </div>
            )}
          </>
        ) : state === 'loading' ? (
          <div className="flex items-center gap-2 py-1">
            <svg className="animate-spin h-3.5 w-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-xs text-zinc-500">Claude is writing your cover letter…</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs text-zinc-500">
              Generate a personalized cover letter for this role.
            </p>
            {/* Template selector */}
            <div className="flex gap-1.5">
              {(['formal', 'casual', 'startup'] as Template[]).map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTemplate(t)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors ${
                    selectedTemplate === t
                      ? 'border-zinc-600 bg-zinc-800 text-zinc-200'
                      : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  <span className="block font-medium">{TEMPLATE_LABELS[t]}</span>
                  <span className="block text-zinc-500 mt-0.5" style={{ fontSize: '9px' }}>
                    {TEMPLATE_DESCRIPTIONS[t]}
                  </span>
                </button>
              ))}
            </div>
            {state === 'error' && error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
            <button
              onClick={handleGenerate}
              className="w-full py-1.5 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
            >
              ✦ Generate cover letter
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
