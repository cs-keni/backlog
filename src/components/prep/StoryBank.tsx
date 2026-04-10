'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Story {
  id: string
  title: string
  theme: string
  situation: string | null
  task: string | null
  action: string | null
  result: string | null
  reflection: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

type Theme =
  | 'leadership' | 'technical' | 'conflict' | 'failure'
  | 'collaboration' | 'initiative' | 'delivery' | 'growth' | 'other'

const THEME_LABELS: Record<Theme, string> = {
  leadership: 'Leadership',
  technical: 'Technical',
  conflict: 'Conflict',
  failure: 'Failure / Learning',
  collaboration: 'Collaboration',
  initiative: 'Initiative',
  delivery: 'Delivery',
  growth: 'Growth',
  other: 'Other',
}

const THEMES = Object.keys(THEME_LABELS) as Theme[]

interface StoryFormState {
  title: string
  theme: Theme
  situation: string
  task: string
  action: string
  result: string
  reflection: string
  tags: string
}

const EMPTY_FORM: StoryFormState = {
  title: '', theme: 'technical',
  situation: '', task: '', action: '', result: '', reflection: '', tags: '',
}

// ─── Root export ───────────────────────────────────────────────────────────────

export function StoryBank() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState<StoryFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/story-bank')
      .then(r => r.json())
      .then((data: Story[]) => setStories(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function startCreate() {
    setCreating(true)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function startEdit(story: Story) {
    setEditingId(story.id)
    setCreating(false)
    setExpandedId(story.id)
    setForm({
      title: story.title,
      theme: story.theme as Theme,
      situation: story.situation ?? '',
      task: story.task ?? '',
      action: story.action ?? '',
      result: story.result ?? '',
      reflection: story.reflection ?? '',
      tags: story.tags.join(', '),
    })
  }

  function cancelForm() {
    setCreating(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.theme) return
    setSaving(true)
    const payload = {
      title: form.title,
      theme: form.theme,
      situation: form.situation || null,
      task: form.task || null,
      action: form.action || null,
      result: form.result || null,
      reflection: form.reflection || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/story-bank/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        const updated = await res.json() as Story
        setStories(prev => prev.map(s => s.id === editingId ? updated : s))
        setEditingId(null)
      } else {
        const res = await fetch('/api/story-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        const created = await res.json() as Story
        setStories(prev => [created, ...prev])
        setCreating(false)
        setExpandedId(created.id)
      }
      setForm(EMPTY_FORM)
    } catch {
      // Leave form open for retry
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/story-bank/${id}`, { method: 'DELETE' })
      setStories(prev => prev.filter(s => s.id !== id))
      if (expandedId === id) setExpandedId(null)
      if (editingId === id) { setEditingId(null); setForm(EMPTY_FORM) }
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="h-5 w-32 bg-zinc-800/50 rounded animate-pulse" />
        <div className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Story Bank</h2>
          <p className="text-xs text-zinc-600 mt-0.5">Reusable STAR narratives — referenced automatically during prep</p>
        </div>
        {!creating && !editingId && (
          <button
            onClick={startCreate}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2.5 py-1 rounded border border-zinc-800 hover:border-zinc-600"
          >
            + New story
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      <AnimatePresence>
        {(creating || editingId) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <StoryForm
              form={form}
              onChange={setForm}
              onSave={handleSave}
              onCancel={cancelForm}
              saving={saving}
              isEditing={!!editingId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story list */}
      {stories.length === 0 && !creating ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center">
          <p className="text-xs text-zinc-600">No stories yet.</p>
          <p className="text-xs text-zinc-700 mt-0.5">Add STAR narratives to reuse across every interview.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stories.map((story, i) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <StoryCard
                story={story}
                isExpanded={expandedId === story.id}
                isEditing={editingId === story.id}
                isDeleting={deletingId === story.id}
                onToggle={() => setExpandedId(expandedId === story.id ? null : story.id)}
                onEdit={() => startEdit(story)}
                onDelete={() => handleDelete(story.id)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Story card ────────────────────────────────────────────────────────────────

function StoryCard({
  story, isExpanded, isEditing, isDeleting, onToggle, onEdit, onDelete,
}: {
  story: Story
  isExpanded: boolean
  isEditing: boolean
  isDeleting: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className={`rounded-lg border transition-colors ${isEditing ? 'border-zinc-600' : 'border-zinc-800'} bg-zinc-900/50 overflow-hidden`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button onClick={onToggle} className="flex-1 flex items-center gap-2.5 text-left min-w-0">
          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 shrink-0">
            {THEME_LABELS[story.theme as Theme] ?? story.theme}
          </span>
          <span className="text-xs font-medium text-zinc-300 truncate">{story.title}</span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="text-xs text-zinc-700 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800 disabled:opacity-40"
          >
            {isDeleting ? '…' : 'Delete'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && !isEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-zinc-800 pt-2.5 space-y-2.5">
              {(['situation', 'task', 'action', 'result', 'reflection'] as const).map(field => (
                story[field] ? (
                  <div key={field}>
                    <p className="text-xs font-medium text-zinc-500 capitalize mb-0.5">
                      {field === 'reflection' ? 'Reflection (optional)' : field}
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{story[field]}</p>
                  </div>
                ) : null
              ))}
              {story.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {story.tags.map((t, i) => (
                    <span key={i} className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Story form ────────────────────────────────────────────────────────────────

function StoryForm({
  form, onChange, onSave, onCancel, saving, isEditing,
}: {
  form: StoryFormState
  onChange: (f: StoryFormState) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isEditing: boolean
}) {
  const set = (field: keyof StoryFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ ...form, [field]: e.target.value })

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
      <p className="text-xs font-semibold text-zinc-300">{isEditing ? 'Edit story' : 'New story'}</p>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Story title (e.g. Led database migration under deadline)"
          value={form.title}
          onChange={set('title')}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        <select
          value={form.theme}
          onChange={set('theme')}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
        >
          {THEMES.map(t => (
            <option key={t} value={t}>{THEME_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {(['situation', 'task', 'action', 'result'] as const).map(field => (
        <div key={field} className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 capitalize">{field}</label>
          <textarea
            value={form[field]}
            onChange={set(field)}
            placeholder={FIELD_PLACEHOLDERS[field]}
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-300 placeholder-zinc-600 leading-relaxed resize-none focus:outline-none focus:border-zinc-500 transition-colors"
            spellCheck
          />
        </div>
      ))}

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-500">Reflection <span className="text-zinc-700">(optional)</span></label>
        <textarea
          value={form.reflection}
          onChange={set('reflection')}
          placeholder="What you'd do differently or what you learned"
          rows={2}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-300 placeholder-zinc-600 leading-relaxed resize-none focus:outline-none focus:border-zinc-500 transition-colors"
          spellCheck
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-500">Tags <span className="text-zinc-700">(comma-separated)</span></label>
        <input
          type="text"
          value={form.tags}
          onChange={set('tags')}
          placeholder="e.g. backend, incident, postgres"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving || !form.title.trim()}
          className="flex-1 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add story'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

const FIELD_PLACEHOLDERS: Record<string, string> = {
  situation: 'The context — what was happening, what was at stake',
  task: 'Your specific responsibility or the challenge you owned',
  action: 'The concrete steps you took — be specific',
  result: 'The outcome — metrics, feedback, or impact if possible',
}
