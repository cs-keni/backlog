'use client'

import { useState, useEffect } from 'react'
import type { StarResponse } from '@/lib/jobs/types'

interface QuestionBankProps {
  companyId: string
  companyName: string
  savedResponses: StarResponse[]
  onResponseSaved: (response: StarResponse) => void
}

interface Questions {
  behavioral_questions: string[]
  technical_questions: string[]
}

interface DraftState {
  question: string
  status: 'idle' | 'generating' | 'editing' | 'saving' | 'saved'
  responseId: string | null
  situation: string
  task: string
  action: string
  result: string
  error: string | null
}

const EMPTY_DRAFT: Omit<DraftState, 'question'> = {
  status: 'idle',
  responseId: null,
  situation: '',
  task: '',
  action: '',
  result: '',
  error: null,
}

export function QuestionBank({ companyId, companyName, savedResponses, onResponseSaved }: QuestionBankProps) {
  const [questions, setQuestions] = useState<Questions | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<DraftState | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/company/${companyId}/questions`)
      .then(r => r.json())
      .then((data: Questions) => setQuestions(data))
      .catch(() => setQuestions({ behavioral_questions: [], technical_questions: [] }))
      .finally(() => setLoading(false))
  }, [companyId])

  function openDraft(question: string) {
    // If there's already a saved response for this question, pre-fill it
    const existing = savedResponses.find(r => r.question === question)
    if (existing) {
      setDraft({
        question,
        status: 'editing',
        responseId: existing.id,
        situation: existing.situation ?? '',
        task: existing.task ?? '',
        action: existing.action ?? '',
        result: existing.result ?? '',
        error: null,
      })
    } else {
      setDraft({ question, ...EMPTY_DRAFT })
    }
  }

  async function handleGenerate() {
    if (!draft) return
    setDraft(d => d ? { ...d, status: 'generating', error: null } : d)
    try {
      const res = await fetch('/api/star-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, question: draft.question, generate: true }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json() as StarResponse
      setDraft(d => d ? {
        ...d,
        status: 'editing',
        responseId: data.id,
        situation: data.situation ?? '',
        task: data.task ?? '',
        action: data.action ?? '',
        result: data.result ?? '',
      } : d)
      onResponseSaved(data)
    } catch {
      setDraft(d => d ? { ...d, status: 'idle', error: 'Generation failed — try again' } : d)
    }
  }

  async function handleSave() {
    if (!draft || !draft.responseId) return
    setDraft(d => d ? { ...d, status: 'saving' } : d)
    try {
      const res = await fetch(`/api/star-responses/${draft.responseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situation: draft.situation,
          task: draft.task,
          action: draft.action,
          result: draft.result,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json() as StarResponse
      onResponseSaved(updated)
      setDraft(d => d ? { ...d, status: 'saved' } : d)
      setTimeout(() => setDraft(null), 1200)
    } catch {
      setDraft(d => d ? { ...d, status: 'editing', error: 'Save failed — try again' } : d)
    }
  }

  function hasSaved(question: string) {
    return savedResponses.some(r => r.question === question)
  }

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Interview Questions</h2>
          <span className="text-xs text-zinc-600">Generating for {companyName}…</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded-lg bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  const allEmpty =
    (questions?.behavioral_questions.length ?? 0) === 0 &&
    (questions?.technical_questions.length ?? 0) === 0

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Interview Questions</h2>

      {allEmpty ? (
        <p className="text-xs text-zinc-600">No questions available — this company may not have enough job data yet.</p>
      ) : (
        <>
          {/* Behavioral */}
          {(questions?.behavioral_questions.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500">Behavioral</p>
              {questions!.behavioral_questions.map((q, i) => (
                <QuestionRow
                  key={i}
                  question={q}
                  hasSaved={hasSaved(q)}
                  isActive={draft?.question === q}
                  onDraft={() => draft?.question === q ? setDraft(null) : openDraft(q)}
                />
              ))}
            </div>
          )}

          {/* Technical */}
          {(questions?.technical_questions.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500">Technical</p>
              {questions!.technical_questions.map((q, i) => (
                <QuestionRow
                  key={i}
                  question={q}
                  hasSaved={hasSaved(q)}
                  isActive={draft?.question === q}
                  onDraft={() => draft?.question === q ? setDraft(null) : openDraft(q)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Inline STAR builder */}
      {draft && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-zinc-300 leading-relaxed flex-1">{draft.question}</p>
            <button
              onClick={() => setDraft(null)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 mt-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {draft.status === 'idle' ? (
            <div className="space-y-2">
              {draft.error && <p className="text-xs text-red-400">{draft.error}</p>}
              <button
                onClick={handleGenerate}
                className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
              >
                ✦ Draft response with Claude
              </button>
            </div>
          ) : draft.status === 'generating' ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-xs text-zinc-500">Claude is drafting your response…</span>
            </div>
          ) : draft.status === 'saved' ? (
            <p className="text-xs text-zinc-500">Saved!</p>
          ) : (
            <div className="space-y-3">
              {(['situation', 'task', 'action', 'result'] as const).map(field => (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500 capitalize">{field}</label>
                  <textarea
                    value={draft[field]}
                    onChange={e => setDraft(d => d ? { ...d, [field]: e.target.value } : d)}
                    rows={3}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-300 leading-relaxed resize-none focus:outline-none focus:border-zinc-500 transition-colors"
                    spellCheck
                  />
                </div>
              ))}
              {draft.error && <p className="text-xs text-red-400">{draft.error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={draft.status === 'saving'}
                  className="flex-1 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors disabled:opacity-50"
                >
                  {draft.status === 'saving' ? 'Saving…' : 'Save response'}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={draft.status === 'saving'}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors disabled:opacity-50"
                >
                  Re-draft
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function QuestionRow({
  question,
  hasSaved,
  isActive,
  onDraft,
}: {
  question: string
  hasSaved: boolean
  isActive: boolean
  onDraft: () => void
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 flex items-start justify-between gap-3 transition-colors ${
      isActive ? 'border-zinc-600 bg-zinc-800/80' : 'border-zinc-800 bg-zinc-900/50'
    }`}>
      <p className="text-xs text-zinc-300 leading-relaxed flex-1">{question}</p>
      <button
        onClick={onDraft}
        className={`shrink-0 text-xs transition-colors px-2 py-0.5 rounded whitespace-nowrap ${
          hasSaved
            ? 'text-zinc-500 hover:text-zinc-300'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        {hasSaved ? (isActive ? 'Close' : 'Edit ↓') : (isActive ? 'Close' : 'Draft ↓')}
      </button>
    </div>
  )
}
