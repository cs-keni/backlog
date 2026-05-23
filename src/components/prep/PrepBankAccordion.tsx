'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ConceptPrimer, PrepQuestion } from '@/lib/prep/prep-types'
import { ConceptPrimerModal } from './ConceptPrimerModal'
import { PrepCoachPanel } from './PrepCoachPanel'
import { PrepSelfRubric } from './PrepSelfRubric'

type PrepBank = 'system-design' | 'ai-engineer'
type QuestionStatus = 'unstudied' | 'studied' | 'needs-review'

interface ProgressRow {
  question_id: string
  bank: PrepBank
  status: QuestionStatus
}

interface PrepBankAccordionProps {
  bank: PrepBank
  title: string
  description: string
}

const DIFFICULTY_CLASS = {
  junior: 'bg-emerald-500/10 text-emerald-400',
  mid: 'bg-yellow-500/10 text-yellow-400',
  senior: 'bg-red-500/10 text-red-400',
}

const STATUS_LABEL: Record<QuestionStatus, string> = {
  unstudied: 'Unstudied',
  studied: 'Studied',
  'needs-review': 'Needs review',
}

function topicLabel(topic: string): string {
  return topic.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function progressCount(questions: PrepQuestion[], progress: Map<string, QuestionStatus>) {
  return questions.filter((question) => {
    const status = progress.get(question.id) ?? 'unstudied'
    return status === 'studied' || status === 'needs-review'
  }).length
}

export function PrepBankAccordion({ bank, title, description }: PrepBankAccordionProps) {
  const [questions, setQuestions] = useState<PrepQuestion[]>([])
  const [primers, setPrimers] = useState<ConceptPrimer[]>([])
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set())
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null)
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set())
  const [selectedPrimer, setSelectedPrimer] = useState<ConceptPrimer | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const [bankRes, progressRes] = await Promise.all([
        fetch(`/api/prep/question-bank?bank=${bank}`),
        fetch('/api/prep/question-progress'),
      ])
      if (bankRes.ok) {
        const payload = await bankRes.json() as { questions: PrepQuestion[]; primers: ConceptPrimer[] }
        setQuestions(payload.questions)
        setPrimers(payload.primers)
      }
      if (progressRes.ok) {
        const rows = await progressRes.json() as ProgressRow[]
        setProgressRows(rows)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    function onChanged() {
      void loadData()
    }
    window.addEventListener('prep-progress-changed', onChanged)
    return () => window.removeEventListener('prep-progress-changed', onChanged)
  }, [bank])

  const progress = useMemo(() => {
    const map = new Map<string, QuestionStatus>()
    for (const row of progressRows) map.set(row.question_id, row.status)
    return map
  }, [progressRows])

  const primerMap = useMemo(() => new Map(primers.map((primer) => [primer.id, primer])), [primers])

  const topics = useMemo(() => {
    const map = new Map<string, PrepQuestion[]>()
    for (const question of questions) {
      const list = map.get(question.topic) ?? []
      list.push(question)
      map.set(question.topic, list)
    }
    return Array.from(map.entries())
  }, [questions])

  async function updateStatus(question: PrepQuestion, status: QuestionStatus) {
    setSavingId(question.id)
    try {
      const res = await fetch('/api/prep/question-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: question.id, bank, status }),
      })
      if (!res.ok) return
      const row = await res.json() as ProgressRow
      setProgressRows((prev) => [...prev.filter((item) => item.question_id !== row.question_id), row])
      window.dispatchEvent(new Event('prep-progress-changed'))
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <section className="space-y-3" id={bank}>
        <div className="space-y-1">
          <div className="h-4 w-40 rounded bg-zinc-800/60 animate-pulse" />
          <div className="h-3 w-72 rounded bg-zinc-800/40 animate-pulse" />
        </div>
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-16 rounded-lg border border-zinc-800 bg-zinc-900/40 animate-pulse" />
        ))}
      </section>
    )
  }

  const completed = progressCount(questions, progress)

  return (
    <section className="space-y-3 scroll-mt-6" id={bank}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-zinc-100">{completed}/{questions.length}</p>
          <p className="text-[11px] text-zinc-600">covered</p>
        </div>
      </div>

      <div className="space-y-2">
        {topics.map(([topic, topicQuestions]) => {
          const topicOpen = openTopics.has(topic)
          const topicCompleted = progressCount(topicQuestions, progress)
          return (
            <div key={topic} className="rounded-lg border border-zinc-800 bg-zinc-950/60">
              <button
                onClick={() => {
                  setOpenTopics((prev) => {
                    const next = new Set(prev)
                    if (next.has(topic)) next.delete(topic)
                    else next.add(topic)
                    return next
                  })
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-200">{topicLabel(topic)}</p>
                  <p className="mt-0.5 text-xs text-zinc-600">{topicQuestions.length} questions</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-20 rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-indigo-400"
                      style={{ width: `${Math.round((topicCompleted / topicQuestions.length) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-zinc-500">{topicCompleted}/{topicQuestions.length}</span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {topicOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-zinc-800"
                  >
                    <div className="divide-y divide-zinc-800">
                      {topicQuestions.map((question) => {
                        const questionOpen = openQuestionId === question.id
                        const status = progress.get(question.id) ?? 'unstudied'
                        return (
                          <div key={question.id} className="px-4 py-3">
                            <button
                              onClick={() => setOpenQuestionId(questionOpen ? null : question.id)}
                              className="flex w-full items-start justify-between gap-3 text-left"
                            >
                              <div>
                                <p className="text-sm leading-5 text-zinc-200">{question.prompt}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${DIFFICULTY_CLASS[question.difficulty]}`}>
                                    {question.difficulty}
                                  </span>
                                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                                    {STATUS_LABEL[status]}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs text-zinc-600">{questionOpen ? 'Collapse' : 'Open'}</span>
                            </button>

                            {questionOpen && (
                              <div className="mt-4 space-y-4">
                                <PrepSelfRubric bank={bank} />

                                <div className="flex flex-wrap gap-2">
                                  {question.concepts.map((concept) => (
                                    <button
                                      key={concept}
                                      onClick={() => {
                                        const primer = primerMap.get(concept)
                                        if (primer) setSelectedPrimer(primer)
                                      }}
                                      className="rounded-full border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                                    >
                                      {concept}
                                    </button>
                                  ))}
                                </div>

                                <div>
                                  {revealedHints.has(question.id) ? (
                                    <div className="space-y-2">
                                      <p className="text-[11px] uppercase tracking-wide text-zinc-600">Hints</p>
                                      {question.hints.map((hint) => (
                                        <p key={hint} className="text-sm leading-6 text-zinc-400">
                                          <span className="text-zinc-600">• </span>{hint}
                                        </p>
                                      ))}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setRevealedHints((prev) => new Set([...prev, question.id]))}
                                      className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
                                    >
                                      Reveal hints
                                    </button>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    disabled={savingId === question.id}
                                    onClick={() => updateStatus(question, 'studied')}
                                    className="rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 disabled:opacity-50"
                                  >
                                    Mark studied
                                  </button>
                                  <button
                                    disabled={savingId === question.id}
                                    onClick={() => updateStatus(question, 'needs-review')}
                                    className="rounded-md bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-400 disabled:opacity-50"
                                  >
                                    Needs review
                                  </button>
                                </div>
                                <PrepCoachPanel bank={bank} questionId={question.id} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
      {selectedPrimer && <ConceptPrimerModal primer={selectedPrimer} onClose={() => setSelectedPrimer(null)} />}
    </section>
  )
}
