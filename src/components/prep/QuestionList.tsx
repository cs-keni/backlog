'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { InterviewGuide, InterviewQuestion } from '@/lib/llm/question-generator'
import { StoryMatchChips, type StoryMatch } from './StoryMatch'

export interface DraftState {
  question: string
  status: 'idle' | 'generating' | 'editing' | 'saving' | 'saved'
  responseId: string | null
  situation: string
  task: string
  action: string
  result: string
  error: string | null
}

interface QuestionListProps {
  guide: InterviewGuide | null
  legacyBehavioral: string[]
  legacyTechnical: string[]
  draft: DraftState | null
  storyMatches: StoryMatch[]
  hasSaved: (question: string) => boolean
  openDraft: (question: string) => void
  setDraft: (draft: DraftState | null) => void
  onGenerate: () => void
  onSave: () => void
}

export function QuestionList({
  guide,
  legacyBehavioral,
  legacyTechnical,
  draft,
  storyMatches,
  hasSaved,
  openDraft,
  setDraft,
  onGenerate,
  onSave,
}: QuestionListProps) {
  const closeOrOpen = (question: string) => draft?.question === question ? setDraft(null) : openDraft(question)

  if (!guide) {
    const allEmpty = legacyBehavioral.length === 0 && legacyTechnical.length === 0
    if (allEmpty) {
      return <p className="text-xs text-zinc-600">No questions available - this company may not have enough job data yet.</p>
    }
    return (
      <>
        {legacyBehavioral.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500">Behavioral</p>
            {legacyBehavioral.map((q, i) => (
              <LegacyQuestionRow key={i} question={q} hasSaved={hasSaved(q)} isActive={draft?.question === q} onDraft={() => closeOrOpen(q)} />
            ))}
          </div>
        )}
        {legacyTechnical.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500">Technical</p>
            {legacyTechnical.map((q, i) => (
              <LegacyQuestionRow key={i} question={q} hasSaved={hasSaved(q)} isActive={draft?.question === q} onDraft={() => closeOrOpen(q)} />
            ))}
          </div>
        )}
        <StarDraftPanel draft={draft} onGenerate={onGenerate} onSave={onSave} onChange={setDraft} onClose={() => setDraft(null)} />
      </>
    )
  }

  return (
    <>
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
              onDraft={() => closeOrOpen(q.question)}
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
              storyMatches={[]}
              onDraft={() => closeOrOpen(q.question)}
            />
          ))}
        </div>
      )}

      <StarDraftPanel draft={draft} onGenerate={onGenerate} onSave={onSave} onChange={setDraft} onClose={() => setDraft(null)} />
    </>
  )
}

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
          <button onClick={onDraft} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-0.5 rounded whitespace-nowrap">
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

      {!isActive && <StoryMatchChips stories={storyMatches} />}
    </div>
  )
}

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
      <button onClick={onDraft} className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-0.5 rounded whitespace-nowrap">
        {hasSaved ? (isActive ? 'Close' : 'Edit ↓') : (isActive ? 'Close' : 'Draft ↓')}
      </button>
    </div>
  )
}

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
  onChange: (draft: DraftState | null) => void
  onClose: () => void
}) {
  if (!draft) return null

  const update = (patch: Partial<DraftState>) => onChange({ ...draft, ...patch })

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
          <button onClick={onGenerate} className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors">
            Draft response with Claude
          </button>
        </div>
      ) : draft.status === 'generating' ? (
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-3.5 w-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-xs text-zinc-500">Claude is drafting your response...</span>
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
                onChange={e => update({ [field]: e.target.value })}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-300 leading-relaxed resize-none focus:outline-none focus:border-zinc-500 transition-colors"
                spellCheck
              />
            </div>
          ))}
          {draft.error && <p className="text-xs text-red-400">{draft.error}</p>}
          <div className="flex gap-2">
            <button onClick={onSave} disabled={draft.status === 'saving'} className="flex-1 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors disabled:opacity-50">
              {draft.status === 'saving' ? 'Saving...' : 'Save response'}
            </button>
            <button onClick={onGenerate} disabled={draft.status === 'saving'} className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors disabled:opacity-50">
              Re-draft
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

