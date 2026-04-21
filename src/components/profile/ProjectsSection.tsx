'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Project } from '@/lib/jobs/types'
import { SkillsInput } from './SkillsInput'

interface ProjectsSectionProps {
  entries: Project[]
  onChange: (entries: Project[]) => void
}

const EMPTY_FORM = {
  name: '',
  role: '',
  description: '',
  tech_stack: [] as string[],
  url: '',
  highlights: [''] as string[],
  start_date: '',
  end_date: '',
  is_current: false,
}

type FormState = typeof EMPTY_FORM

function HighlightsList({
  highlights,
  onChange,
}: {
  highlights: string[]
  onChange: (h: string[]) => void
}) {
  function update(i: number, val: string) {
    const next = [...highlights]
    next[i] = val
    onChange(next)
  }

  function remove(i: number) {
    onChange(highlights.filter((_, idx) => idx !== i))
  }

  function add() {
    if (highlights.length < 5) onChange([...highlights, ''])
  }

  return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-400">
        Highlights <span className="text-zinc-600">(up to 5 bullets)</span>
      </label>
      <div className="space-y-1.5">
        {highlights.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-zinc-600 text-sm shrink-0">•</span>
            <input
              value={h}
              onChange={e => update(i, e.target.value)}
              placeholder={`Highlight ${i + 1}…`}
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
            />
            {highlights.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-zinc-600 hover:text-red-400 text-sm px-1 transition-colors"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {highlights.length < 5 && (
        <button
          type="button"
          onClick={add}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          + Add highlight
        </button>
      )}
    </div>
  )
}

function EntryForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState
  onSave: (data: FormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  return (
    <div className="space-y-3 p-4 rounded-lg bg-zinc-900 border border-zinc-700">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Project Name *</label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Backlog"
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Your Role</label>
          <input
            value={form.role}
            onChange={e => set('role', e.target.value)}
            placeholder="Solo developer"
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Tech Stack</label>
        <SkillsInput
          skills={form.tech_stack}
          onChange={ts => set('tech_stack', ts)}
          placeholder="Next.js, TypeScript, Supabase…"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Description</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Brief description of what this project does…"
          rows={2}
          className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 resize-none"
        />
      </div>

      <HighlightsList
        highlights={form.highlights}
        onChange={h => set('highlights', h)}
      />

      <div className="space-y-1">
        <label className="text-xs text-zinc-400">URL</label>
        <input
          value={form.url}
          onChange={e => set('url', e.target.value)}
          placeholder="https://github.com/you/project"
          className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Start Date</label>
          <input
            type="month"
            value={form.start_date}
            onChange={e => set('start_date', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">End Date</label>
          <input
            type="month"
            value={form.end_date}
            onChange={e => set('end_date', e.target.value)}
            disabled={form.is_current}
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-40"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_current}
          onChange={e => set('is_current', e.target.checked)}
          className="accent-emerald-500"
        />
        <span className="text-xs text-zinc-400">Currently working on this</span>
      </label>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-100 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export function ProjectsSection({ entries, onChange }: ProjectsSectionProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function formToPayload(form: FormState) {
    return {
      name: form.name,
      role: form.role || null,
      description: form.description || null,
      tech_stack: form.tech_stack,
      url: form.url || null,
      highlights: form.highlights.filter(h => h.trim()),
      start_date: form.start_date || null,
      end_date: form.is_current ? null : (form.end_date || null),
      is_current: form.is_current,
    }
  }

  async function handleAdd(form: FormState) {
    setSaving(true)
    try {
      const res = await fetch('/api/profile/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formToPayload(form), display_order: entries.length }),
      })
      if (res.ok) {
        const created = await res.json() as Project
        onChange([...entries, created])
        setAdding(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(id: string, form: FormState) {
    setSaving(true)
    try {
      const res = await fetch(`/api/profile/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      })
      if (res.ok) {
        const updated = await res.json() as Project
        onChange(entries.map(e => e.id === id ? updated : e))
        setEditingId(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/profile/projects/${id}`, { method: 'DELETE' })
    onChange(entries.filter(e => e.id !== id))
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return ''
    const [year, month] = dateStr.split('-')
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  function entryToForm(entry: Project): FormState {
    return {
      name: entry.name,
      role: entry.role ?? '',
      description: entry.description ?? '',
      tech_stack: entry.tech_stack,
      url: entry.url ?? '',
      highlights: entry.highlights.length > 0 ? entry.highlights : [''],
      start_date: entry.start_date?.slice(0, 7) ?? '',
      end_date: entry.end_date?.slice(0, 7) ?? '',
      is_current: entry.is_current,
    }
  }

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {entries.map(entry => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
          >
            {editingId === entry.id ? (
              <EntryForm
                initial={entryToForm(entry)}
                onSave={form => handleEdit(entry.id, form)}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-100">{entry.name}</p>
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        ↗ Link
                      </a>
                    )}
                  </div>
                  {entry.role && (
                    <p className="text-xs text-zinc-400">{entry.role}</p>
                  )}
                  {(entry.start_date || entry.end_date || entry.is_current) && (
                    <p className="text-xs text-zinc-600">
                      {formatDate(entry.start_date)} – {entry.is_current ? 'Present' : formatDate(entry.end_date)}
                    </p>
                  )}
                  {entry.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tech_stack.map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs text-zinc-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {entry.highlights.length > 0 && (
                    <ul className="space-y-0.5">
                      {entry.highlights.slice(0, 3).map((h, i) => (
                        <li key={i} className="text-xs text-zinc-500 flex gap-1.5">
                          <span className="text-zinc-700 shrink-0">•</span>
                          <span className="line-clamp-1">{h}</span>
                        </li>
                      ))}
                      {entry.highlights.length > 3 && (
                        <li className="text-xs text-zinc-600">+{entry.highlights.length - 3} more</li>
                      )}
                    </ul>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditingId(entry.id)}
                    className="px-2 py-1 rounded text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="px-2 py-1 rounded text-xs text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                  >
                    Delete
                  </button>
                </div>
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
          >
            <EntryForm
              initial={EMPTY_FORM}
              onSave={handleAdd}
              onCancel={() => setAdding(false)}
              saving={saving}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
        >
          + Add project
        </button>
      )}
    </div>
  )
}
