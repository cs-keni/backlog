'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { StarResponse } from '@/lib/jobs/types'
import type { InterviewGuide, InterviewQuestion } from '@/lib/llm/question-generator'

interface QuestionBankProps {
  companyId: string
  companyName: string
  savedResponses: StarResponse[]
  storyMatches?: StoryMatch[] // stories from story bank, pre-filtered by theme
  onResponseSaved: (response: StarResponse) => void
}

export interface StoryMatch {
  id: string
  title: string
  theme: string
  situation: string | null
  action: string | null
  result: string | null
}

interface LegacyResponse {
  guide: null
  behavioral_questions: string[]
  technical_questions: string[]
}

interface GuideResponse {
  guide: InterviewGuide
}

type QuestionsResponse = LegacyResponse | GuideResponse

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

// ─── Tab types ─────────────────────────────────────────────────────────────────

type Tab = 'questions' | 'overview' | 'culture'

// ─── Root export ───────────────────────────────────────────────────────────────

export function QuestionBank({
  companyId,
  companyName,
  savedResponses,
  storyMatches = [],
  onResponseSaved,
}: QuestionBankProps) {
  const [response, setResponse] = useState<QuestionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('questions')

  function loadQuestions() {
    setLoading(true)
    setFetchError(false)
    fetch(`/api/company/${companyId}/questions`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: QuestionsResponse) => setResponse(data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadQuestions() }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  function openDraft(question: string) {
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
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Interview Intelligence</h2>
          <span className="text-xs text-zinc-600">Researching {companyName}…</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded-lg bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (fetchError) {
    return (
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Interview Intelligence</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-4 flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">Generation timed out — this can happen on the first load. Try again.</p>
          <button
            onClick={loadQuestions}
            className="shrink-0 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-500"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  const guide = response && 'guide' in response && response.guide ? response.guide : null

  // Legacy fallback: simple question arrays without the rich guide
  if (!guide) {
    const legacyBehavioral = response && 'behavioral_questions' in response ? response.behavioral_questions : []
    const legacyTechnical = response && 'technical_questions' in response ? response.technical_questions : []
    const allEmpty = legacyBehavioral.length === 0 && legacyTechnical.length === 0

    return (
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Interview Questions</h2>
        {allEmpty ? (
          <p className="text-xs text-zinc-600">No questions available — this company may not have enough job data yet.</p>
        ) : (
          <>
            {legacyBehavioral.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500">Behavioral</p>
                {legacyBehavioral.map((q, i) => (
                  <LegacyQuestionRow key={i} question={q} hasSaved={hasSaved(q)} isActive={draft?.question === q} onDraft={() => draft?.question === q ? setDraft(null) : openDraft(q)} />
                ))}
              </div>
            )}
            {legacyTechnical.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500">Technical</p>
                {legacyTechnical.map((q, i) => (
                  <LegacyQuestionRow key={i} question={q} hasSaved={hasSaved(q)} isActive={draft?.question === q} onDraft={() => draft?.question === q ? setDraft(null) : openDraft(q)} />
                ))}
              </div>
            )}
            <StarDraftPanel draft={draft} onGenerate={handleGenerate} onSave={handleSave} onChange={setDraft} onClose={() => setDraft(null)} />
          </>
        )}
      </section>
    )
  }

  // Rich guide view
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'questions', label: 'Questions' },
    { id: 'overview', label: 'Process' },
    { id: 'culture', label: 'Culture' },
  ]

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Interview Intelligence</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-t-md -mb-px border-b-2 ${
              activeTab === tab.id
                ? 'text-zinc-100 border-zinc-300'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'questions' && (
          <motion.div
            key="questions"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {guide.behavioral_questions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500">Behavioral</p>
                {guide.behavioral_questions.map((q, i) => (
                  <RichQuestionRow
                    key={i}
                    q={q}
                    hasSaved={hasSaved(q.question)}
                    isActive={draft?.question === q.question}
                    storyMatches={storyMatches}
                    onDraft={() => draft?.question === q.question ? setDraft(null) : openDraft(q.question)}
                  />
                ))}
              </div>
            )}

            {guide.technical_questions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500">Technical</p>
                {guide.technical_questions.map((q, i) => (
                  <RichQuestionRow
                    key={i}
                    q={q}
                    hasSaved={hasSaved(q.question)}
                    isActive={draft?.question === q.question}
                    storyMatches={[]} // story bank is behavioral only
                    onDraft={() => draft?.question === q.question ? setDraft(null) : openDraft(q.question)}
                  />
                ))}
              </div>
            )}

            <StarDraftPanel draft={draft} onGenerate={handleGenerate} onSave={handleSave} onChange={setDraft} onClose={() => setDraft(null)} />
          </motion.div>
        )}

        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {guide.overview && (
              <p className="text-xs text-zinc-400 leading-relaxed">{guide.overview}</p>
            )}

            {guide.rounds.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Rounds</p>
                {guide.rounds.map((round, i) => (
                  <div key={i} className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
                    <span className="text-xs text-zinc-600 shrink-0 w-4 mt-0.5">{i + 1}.</span>
                    <div>
                      <p className="text-xs font-medium text-zinc-300">{round.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{round.focus}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {guide.questions_to_ask.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Ask Your Interviewer</p>
                {guide.questions_to_ask.map((q, i) => (
                  <div key={i} className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-3 py-2.5">
                    <p className="text-xs text-zinc-400 leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'culture' && (
          <motion.div
            key="culture"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {guide.cultural_signals.values.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Core Values They Screen For</p>
                <div className="flex flex-wrap gap-1.5">
                  {guide.cultural_signals.values.map((v, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs text-zinc-300 border border-zinc-700">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {guide.cultural_signals.terminology.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Know These Terms</p>
                <div className="flex flex-wrap gap-1.5">
                  {guide.cultural_signals.terminology.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {guide.cultural_signals.avoid.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Anti-Patterns to Avoid</p>
                {guide.cultural_signals.avoid.map((a, i) => (
                  <div key={i} className="flex gap-2 rounded-lg border border-red-900/30 bg-red-950/20 px-3 py-2">
                    <span className="text-red-500 text-xs shrink-0 mt-0.5">✕</span>
                    <p className="text-xs text-zinc-400 leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── Rich question row (with hint + story matches) ────────────────────────────

function RichQuestionRow({
  q,
  hasSaved,
  isActive,
  storyMatches,
  onDraft,
}: {
  q: InterviewQuestion
  hasSaved: boolean
  isActive: boolean
  storyMatches: StoryMatch[]
  onDraft: () => void
}) {
  const [showHint, setShowHint] = useState(false)

  return (
    <div className={`rounded-lg border transition-colors ${isActive ? 'border-zinc-600 bg-zinc-800/80' : 'border-zinc-800 bg-zinc-900/50'}`}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <p className="text-xs text-zinc-300 leading-relaxed flex-1">{q.question}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {q.hint && (
            <button
              onClick={() => setShowHint(s => !s)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800"
              title="Strong answer hint"
            >
              {showHint ? '↑' : '?'}
            </button>
          )}
          <button
            onClick={onDraft}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-0.5 rounded whitespace-nowrap"
          >
            {hasSaved ? (isActive ? 'Close' : 'Edit ↓') : (isActive ? 'Close' : 'Draft ↓')}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showHint && q.hint && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 border-t border-zinc-800 pt-2">
              <p className="text-xs text-zinc-500 italic leading-relaxed">{q.hint}</p>
              {q.topics && q.topics.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {q.topics.map((t, i) => (
                    <span key={i} className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story bank matches */}
      {storyMatches.length > 0 && !isActive && (
        <div className="px-3 pb-2 border-t border-zinc-800/50 pt-2">
          <p className="text-xs text-zinc-600 mb-1">Story bank:</p>
          <div className="flex gap-1.5 flex-wrap">
            {storyMatches.slice(0, 2).map(story => (
              <span key={story.id} className="text-xs bg-zinc-800/60 text-zinc-500 px-2 py-0.5 rounded border border-zinc-700/50">
                {story.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Legacy question row (no hint) ────────────────────────────────────────────

function LegacyQuestionRow({
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
        className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-0.5 rounded whitespace-nowrap"
      >
        {hasSaved ? (isActive ? 'Close' : 'Edit ↓') : (isActive ? 'Close' : 'Draft ↓')}
      </button>
    </div>
  )
}

// ─── STAR draft panel ─────────────────────────────────────────────────────────

function StarDraftPanel({
  draft,
  onGenerate,
  onSave,
  onChange,
  onClose,
}: {
  draft: DraftState | null
  onGenerate: () => void
  onSave: () => void
  onChange: (updater: (d: DraftState | null) => DraftState | null) => void
  onClose: () => void
}) {
  if (!draft) return null

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-zinc-300 leading-relaxed flex-1">{draft.question}</p>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 mt-0.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {draft.status === 'idle' ? (
        <div className="space-y-2">
          {draft.error && <p className="text-xs text-red-400">{draft.error}</p>}
          <button
            onClick={onGenerate}
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
                onChange={e => onChange(d => d ? { ...d, [field]: e.target.value } : d)}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-300 leading-relaxed resize-none focus:outline-none focus:border-zinc-500 transition-colors"
                spellCheck
              />
            </div>
          ))}
          {draft.error && <p className="text-xs text-red-400">{draft.error}</p>}
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={draft.status === 'saving'}
              className="flex-1 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors disabled:opacity-50"
            >
              {draft.status === 'saving' ? 'Saving…' : 'Save response'}
            </button>
            <button
              onClick={onGenerate}
              disabled={draft.status === 'saving'}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors disabled:opacity-50"
            >
              Re-draft
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
