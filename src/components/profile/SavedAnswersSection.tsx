'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SavedAnswer } from '@/lib/jobs/types'

interface SavedAnswersSectionProps {
  answers: SavedAnswer[]
  onChange: (answers: SavedAnswer[]) => void
}

export function SavedAnswersSection({ answers, onChange }: SavedAnswersSectionProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [editQ, setEditQ] = useState('')
  const [editA, setEditA] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!newQ.trim() || !newA.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/profile/saved-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newQ.trim(), answer: newA.trim() }),
      })
      if (res.ok) {
        const created = await res.json() as SavedAnswer
        onChange([created, ...answers])
        setNewQ('')
        setNewA('')
        setAdding(false)
      }
    } finally {
      setSaving(false)
    }
  }

  function startEdit(answer: SavedAnswer) {
    setEditingId(answer.id)
    setEditQ(answer.question)
    setEditA(answer.answer)
  }

  async function handleEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/profile/saved-answers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: editQ.trim(), answer: editA.trim() }),
      })
      if (res.ok) {
        const updated = await res.json() as SavedAnswer
        onChange(answers.map(a => a.id === id ? updated : a))
        setEditingId(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/profile/saved-answers/${id}`, { method: 'DELETE' })
    onChange(answers.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Pre-written answers to common application questions. The browser extension checks these before generating a response with AI.
      </p>

      <AnimatePresence initial={false}>
        {answers.map(answer => (
          <motion.div
            key={answer.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
          >
            {editingId === answer.id ? (
              <div className="space-y-2 p-4 rounded-lg bg-zinc-900 border border-zinc-700">
                <input
                  value={editQ}
                  onChange={e => setEditQ(e.target.value)}
                  placeholder="Question"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
                />
                <textarea
                  value={editA}
                  onChange={e => setEditA(e.target.value)}
                  placeholder="Answer"
                  rows={3}
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={() => handleEdit(answer.id)}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-100 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-zinc-300">{answer.question}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(answer)}
                      className="px-2 py-0.5 rounded text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(answer.id)}
                      className="px-2 py-0.5 rounded text-xs text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 line-clamp-3">{answer.answer}</p>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 p-4 rounded-lg bg-zinc-900 border border-zinc-700"
          >
            <input
              value={newQ}
              onChange={e => setNewQ(e.target.value)}
              placeholder="Why do you want to work here?"
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
            />
            <textarea
              value={newA}
              onChange={e => setNewA(e.target.value)}
              placeholder="Your pre-written answer…"
              rows={3}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !newQ.trim() || !newA.trim()}
                className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-100 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
        >
          + Add answer
        </button>
      )}
    </div>
  )
}
