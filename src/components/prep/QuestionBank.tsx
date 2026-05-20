'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { StarResponse } from '@/lib/jobs/types'
import type { InterviewGuide } from '@/lib/llm/question-generator'
import { CulturalSignals } from './CulturalSignals'
import { QuestionList } from './QuestionList'
import { QuestionsToAsk } from './QuestionsToAsk'
import type { StoryMatch } from './StoryMatch'

interface QuestionBankProps {
  companyId: string
  companyName: string
  savedResponses: StarResponse[]
  storyMatches?: StoryMatch[] // stories from story bank, pre-filtered by theme
  onResponseSaved: (response: StarResponse) => void
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
          <QuestionList
            guide={null}
            legacyBehavioral={legacyBehavioral}
            legacyTechnical={legacyTechnical}
            draft={draft}
            storyMatches={storyMatches}
            hasSaved={hasSaved}
            openDraft={openDraft}
            setDraft={setDraft}
            onGenerate={handleGenerate}
            onSave={handleSave}
          />
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
            <QuestionList
              guide={guide}
              legacyBehavioral={[]}
              legacyTechnical={[]}
              draft={draft}
              storyMatches={storyMatches}
              hasSaved={hasSaved}
              openDraft={openDraft}
              setDraft={setDraft}
              onGenerate={handleGenerate}
              onSave={handleSave}
            />
          </motion.div>
        )}

        {activeTab === 'overview' && (
          <QuestionsToAsk guide={guide} />
        )}

        {activeTab === 'culture' && (
          <CulturalSignals guide={guide} />
        )}
      </AnimatePresence>
    </section>
  )
}
