'use client'

import { useEffect, useState } from 'react'
import type { PrepQuestion } from '@/lib/prep/prep-types'

interface ReviewItem {
  id: string
  bank: 'system-design' | 'ai-engineer'
  question_id: string
  next_review_at: string
  interval_days: number
  question: PrepQuestion
}

export function PrepReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/prep/prep-reviews')
      if (res.ok) setItems(await res.json() as ReviewItem[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    function onChanged() {
      void load()
    }
    window.addEventListener('prep-progress-changed', onChanged)
    return () => window.removeEventListener('prep-progress-changed', onChanged)
  }, [])

  async function complete(item: ReviewItem, difficulty: 'easy' | 'hard') {
    setSavingId(item.id)
    try {
      const res = await fetch(`/api/prep/prep-reviews/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty }),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((candidate) => candidate.id !== item.id))
        window.dispatchEvent(new Event('prep-progress-changed'))
      }
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Today&apos;s Review Queue</h2>
        <p className="mt-1 text-xs text-zinc-500">Spaced repetition across both prep banks.</p>
      </div>
      {loading ? (
        <div className="h-24 rounded-lg border border-zinc-800 bg-zinc-900/40 animate-pulse" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-5">
          <p className="text-sm text-zinc-400">You&apos;re all caught up for today</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300">
                    {item.bank === 'system-design' ? 'System Design' : 'AI Eng'}
                  </span>
                  <p className="mt-2 text-sm leading-5 text-zinc-200">{item.question.prompt}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    disabled={savingId === item.id}
                    onClick={() => complete(item, 'hard')}
                    className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-yellow-400 disabled:opacity-50"
                  >
                    Hard
                  </button>
                  <button
                    disabled={savingId === item.id}
                    onClick={() => complete(item, 'easy')}
                    className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-emerald-400 disabled:opacity-50"
                  >
                    Easy
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
