'use client'

import { useState } from 'react'

type PrepBank = 'system-design' | 'ai-engineer'

interface RubricItem {
  id: string
  label: string
  hint: string
}

const UNIVERSAL_RUBRIC: Record<PrepBank, RubricItem[]> = {
  'system-design': [
    { id: 'requirements', label: 'Requirements clarification', hint: 'Functional + non-functional (latency, availability, scale)' },
    { id: 'capacity', label: 'Capacity estimation', hint: 'QPS, storage, bandwidth back-of-envelope' },
    { id: 'architecture', label: 'High-level architecture', hint: 'Core components and how data flows between them' },
    { id: 'data-model', label: 'Data model / schema', hint: 'Tables, key fields, relationships' },
    { id: 'api', label: 'API design', hint: 'Endpoints, request/response shape' },
    { id: 'bottlenecks', label: 'Bottlenecks identified', hint: 'Where does the system break under load?' },
    { id: 'scaling', label: 'Scaling strategy', hint: 'Caching, sharding, load balancing, replication' },
    { id: 'tradeoffs', label: 'Trade-offs discussed', hint: 'What did you choose and why?' },
  ],
  'ai-engineer': [
    { id: 'framing', label: 'Problem framing', hint: 'What are we solving and why?' },
    { id: 'architecture', label: 'Architecture / system components', hint: 'How the pieces fit together end-to-end' },
    { id: 'model-selection', label: 'Model or technique selection', hint: 'With rationale for the choice' },
    { id: 'data-pipeline', label: 'Data pipeline and preprocessing', hint: 'How data flows in, gets cleaned and transformed' },
    { id: 'evaluation', label: 'Evaluation strategy', hint: 'Metrics, offline vs online eval' },
    { id: 'production', label: 'Production concerns', hint: 'Latency, cost, monitoring, observability' },
    { id: 'failures', label: 'Failure modes and mitigations', hint: 'What breaks and how do you handle it?' },
    { id: 'tradeoffs', label: 'Trade-offs discussed', hint: 'What did you choose and why?' },
  ],
}

interface PrepSelfRubricProps {
  bank: PrepBank
  problemRubric?: string[]
}

export function PrepSelfRubric({ bank, problemRubric }: PrepSelfRubricProps) {
  const universal = UNIVERSAL_RUBRIC[bank]
  const total = universal.length + (problemRubric?.length ?? 0)

  const [checked, setChecked] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const score = checked.size
  const pct = total > 0 ? Math.round((score / total) * 100) : 0

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Self-Check</h4>
        <span className="text-[11px] tabular-nums text-zinc-500">{score} / {total} covered</span>
      </div>

      <div className="space-y-1">
        {universal.map((item) => (
          <RubricRow
            key={item.id}
            id={item.id}
            label={item.label}
            hint={item.hint}
            checked={checked.has(item.id)}
            onToggle={toggle}
          />
        ))}
      </div>

      {problemRubric && problemRubric.length > 0 && (
        <div className="space-y-1 border-t border-zinc-800 pt-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-zinc-600">Problem-specific</p>
          {problemRubric.map((label, i) => {
            const id = `problem-${i}`
            return (
              <RubricRow
                key={id}
                id={id}
                label={label}
                checked={checked.has(id)}
                onToggle={toggle}
              />
            )
          })}
        </div>
      )}

      <div className="pt-1 space-y-1.5">
        <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-1 rounded-full bg-indigo-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {score === total && total > 0 && (
          <p className="text-[11px] text-emerald-400">Nice — you covered it all. Mark it studied below.</p>
        )}
      </div>
    </div>
  )
}

interface RubricRowProps {
  id: string
  label: string
  hint?: string
  checked: boolean
  onToggle: (id: string) => void
}

function RubricRow({ id, label, hint, checked, onToggle }: RubricRowProps) {
  return (
    <button
      onClick={() => onToggle(id)}
      className="flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left hover:bg-zinc-900/60 transition-colors"
    >
      <span
        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
            : 'border-zinc-700 bg-transparent'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 10 8" fill="none" className="h-2 w-2">
            <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <div>
        <p className={`text-xs leading-5 transition-colors ${checked ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-zinc-300'}`}>
          {label}
        </p>
        {hint && !checked && (
          <p className="text-[11px] leading-4 text-zinc-600">{hint}</p>
        )}
      </div>
    </button>
  )
}
