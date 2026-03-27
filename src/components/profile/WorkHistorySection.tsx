'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WorkHistory } from '@/lib/jobs/types'

interface WorkHistorySectionProps {
  entries: WorkHistory[]
  onChange: (entries: WorkHistory[]) => void
}

const EMPTY_FORM = {
  company: '', title: '', start_date: '', end_date: '', is_current: false, description: '',
}

type FormState = typeof EMPTY_FORM

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
  const set = (key: keyof FormState, value: string | boolean) =>
    setForm(f => ({ ...f, [key]: value }))

  return (
    <div className="space-y-3 p-4 rounded-lg bg-zinc-900 border border-zinc-700">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Company *</label>
          <input
            value={form.company}
            onChange={e => set('company', e.target.value)}
            placeholder="Acme Corp"
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Title *</label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Software Engineer"
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
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
        <span className="text-xs text-zinc-400">I currently work here</span>
      </label>
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Description</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Key responsibilities and achievements…"
          rows={3}
          className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 resize-none"
        />
      </div>
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
          disabled={saving || !form.company.trim() || !form.title.trim()}
          className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-100 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export function WorkHistorySection({ entries, onChange }: WorkHistorySectionProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleAdd(form: FormState) {
    setSaving(true)
    try {
      const res = await fetch('/api/profile/work-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          start_date: form.start_date || null,
          end_date: form.is_current ? null : (form.end_date || null),
          display_order: entries.length,
        }),
      })
      if (res.ok) {
        const created = await res.json() as WorkHistory
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
      const res = await fetch(`/api/profile/work-history/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          start_date: form.start_date || null,
          end_date: form.is_current ? null : (form.end_date || null),
        }),
      })
      if (res.ok) {
        const updated = await res.json() as WorkHistory
        onChange(entries.map(e => e.id === id ? updated : e))
        setEditingId(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/profile/work-history/${id}`, { method: 'DELETE' })
    onChange(entries.filter(e => e.id !== id))
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return ''
    const [year, month] = dateStr.split('-')
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
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
                initial={{
                  company: entry.company,
                  title: entry.title,
                  start_date: entry.start_date?.slice(0, 7) ?? '',
                  end_date: entry.end_date?.slice(0, 7) ?? '',
                  is_current: entry.is_current,
                  description: entry.description ?? '',
                }}
                onSave={form => handleEdit(entry.id, form)}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-100">{entry.title}</p>
                  <p className="text-xs text-zinc-400">{entry.company}</p>
                  {(entry.start_date || entry.end_date || entry.is_current) && (
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {formatDate(entry.start_date)} – {entry.is_current ? 'Present' : formatDate(entry.end_date)}
                    </p>
                  )}
                  {entry.description && (
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{entry.description}</p>
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
          + Add position
        </button>
      )}
    </div>
  )
}
