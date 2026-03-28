'use client'

import { useState } from 'react'
import type { StarResponse } from '@/lib/jobs/types'

interface StarResponseSectionProps {
  responses: StarResponse[]
  onDeleted: (id: string) => void
  onUpdated: (response: StarResponse) => void
}

export function StarResponseSection({ responses, onDeleted, onUpdated }: StarResponseSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ situation: string; task: string; action: string; result: string } | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function startEdit(response: StarResponse) {
    setEditingId(response.id)
    setExpandedId(response.id)
    setEditDraft({
      situation: response.situation ?? '',
      task: response.task ?? '',
      action: response.action ?? '',
      result: response.result ?? '',
    })
  }

  async function handleSaveEdit(id: string) {
    if (!editDraft) return
    setSaveState('saving')
    try {
      const res = await fetch(`/api/star-responses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json() as StarResponse
      onUpdated(updated)
      setSaveState('saved')
      setEditingId(null)
      setEditDraft(null)
      setTimeout(() => setSaveState('idle'), 1500)
    } catch {
      setSaveState('idle')
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/star-responses/${id}`, { method: 'DELETE' })
      onDeleted(id)
    } catch {
      // ignore — optimistic UI would be nicer but not worth the complexity here
    } finally {
      setDeletingId(null)
    }
  }

  if (responses.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        Saved Responses ({responses.length})
      </h2>
      <div className="space-y-2">
        {responses.map(r => {
          const isExpanded = expandedId === r.id
          const isEditing = editingId === r.id

          return (
            <div key={r.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="flex-1 text-left text-xs text-zinc-300 leading-relaxed"
                >
                  {r.question}
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => startEdit(r)}
                    className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="text-xs text-zinc-700 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800 disabled:opacity-40"
                  >
                    {deletingId === r.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && !isEditing && (
                <div className="px-3 pb-3 space-y-2.5 border-t border-zinc-800 pt-2.5">
                  {(['situation', 'task', 'action', 'result'] as const).map(field => (
                    r[field] ? (
                      <div key={field}>
                        <p className="text-xs font-medium text-zinc-500 capitalize mb-0.5">{field}</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">{r[field]}</p>
                      </div>
                    ) : null
                  ))}
                </div>
              )}

              {/* Edit form */}
              {isEditing && editDraft && (
                <div className="px-3 pb-3 space-y-3 border-t border-zinc-800 pt-3">
                  {(['situation', 'task', 'action', 'result'] as const).map(field => (
                    <div key={field} className="space-y-1">
                      <label className="text-xs font-medium text-zinc-500 capitalize">{field}</label>
                      <textarea
                        value={editDraft[field]}
                        onChange={e => setEditDraft(d => d ? { ...d, [field]: e.target.value } : d)}
                        rows={3}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-300 leading-relaxed resize-none focus:outline-none focus:border-zinc-500 transition-colors"
                        spellCheck
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(r.id)}
                      disabled={saveState === 'saving'}
                      className="flex-1 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors disabled:opacity-50"
                    >
                      {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved!' : 'Save changes'}
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditDraft(null) }}
                      className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
