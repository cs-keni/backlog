'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PrepQuestion } from '@/lib/prep/prep-types'
import { getSpotlightQuestions } from '@/lib/prep/spotlight-logic'

interface ApplicationSummary {
  status: string
  jobs: {
    title: string
    company: string
  }
}

export function CompanySpotlight() {
  const [apps, setApps] = useState<ApplicationSummary[]>([])
  const [questions, setQuestions] = useState<PrepQuestion[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/applications').then((res) => res.ok ? res.json() : []),
      fetch('/api/prep/question-bank?bank=system-design').then((res) => res.ok ? res.json() : null),
      fetch('/api/prep/question-bank?bank=ai-engineer').then((res) => res.ok ? res.json() : null),
    ])
      .then(([applicationPayload, sdPayload, aiPayload]) => {
        setApps(Array.isArray(applicationPayload) ? applicationPayload : [])
        setQuestions([
          ...((sdPayload?.questions ?? []) as PrepQuestion[]),
          ...((aiPayload?.questions ?? []) as PrepQuestion[]),
        ])
      })
      .catch(() => {})
  }, [])

  const activeCompanies = useMemo(() => apps
    .filter((app) => ['phone_screen', 'technical', 'final'].includes(app.status))
    .map((app) => app.jobs.company)
    .filter(Boolean), [apps])

  const spotlight = useMemo(
    () => getSpotlightQuestions(activeCompanies, questions),
    [activeCompanies, questions]
  )

  if (spotlight.length === 0) return null

  const companyLabel = Array.from(new Set(activeCompanies)).slice(0, 2).join(', ')

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Company Spotlight</h2>
        <p className="mt-1 text-xs text-zinc-500">Questions relevant to {companyLabel}&apos;s domain.</p>
      </div>
      <div className="space-y-2">
        {spotlight.map((question) => (
          <div key={question.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-5 text-zinc-200">{question.prompt}</p>
              <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                {question.id.startsWith('sd-') ? 'SD' : 'AI'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
