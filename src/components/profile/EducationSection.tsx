'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Education } from '@/lib/jobs/types'

interface EducationSectionProps {
  entries: Education[]
  onChange: (entries: Education[]) => void
}

const EMPTY_FORM = {
  school: '', degree: '', field_of_study: '', gpa: '', graduation_year: '',
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
  const set = (key: keyof FormState, value: string) => setForm(f => ({ ...f, [key]: value }))

  return (
    <div className="space-y-3 p-4 rounded-lg bg-zinc-900 border border-zinc-700">
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">School *</label>
        <input
          value={form.school}
          onChange={e => set('school', e.target.value)}
          placeholder="University of Oregon"
          className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Degree</label>
          <input
            value={form.degree}
            onChange={e => set('degree', e.target.value)}
            placeholder="B.S."
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Field of Study</label>
          <input
            value={form.field_of_study}
            onChange={e => set('field_of_study', e.target.value)}
            placeholder="Computer Science"
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">GPA</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="4"
            value={form.gpa}
            onChange={e => set('gpa', e.target.value)}
            placeholder="3.8"
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Graduation Year</label>
          <input
            type="number"
            min="1950"
            max="2035"
            value={form.graduation_year}
            onChange={e => set('graduation_year', e.target.value)}
            placeholder="2025"
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
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
          disabled={saving || !form.school.trim()}
          className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-100 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export function EducationSection({ entries, onChange }: EducationSectionProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleAdd(form: FormState) {
    setSaving(true)
    try {
      const res = await fetch('/api/profile/education', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school: form.school,
          degree: form.degree || null,
          field_of_study: form.field_of_study || null,
          gpa: form.gpa ? parseFloat(form.gpa) : null,
          graduation_year: form.graduation_year ? parseInt(form.graduation_year) : null,
          display_order: entries.length,
        }),
      })
      if (res.ok) {
        const created = await res.json() as Education
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
      const res = await fetch(`/api/profile/education/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school: form.school,
          degree: form.degree || null,
          field_of_study: form.field_of_study || null,
          gpa: form.gpa ? parseFloat(form.gpa) : null,
          graduation_year: form.graduation_year ? parseInt(form.graduation_year) : null,
        }),
      })
      if (res.ok) {
        const updated = await res.json() as Education
        onChange(entries.map(e => e.id === id ? updated : e))
        setEditingId(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/profile/education/${id}`, { method: 'DELETE' })
    onChange(entries.filter(e => e.id !== id))
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
                  school: entry.school,
                  degree: entry.degree ?? '',
                  field_of_study: entry.field_of_study ?? '',
                  gpa: entry.gpa?.toString() ?? '',
                  graduation_year: entry.graduation_year?.toString() ?? '',
                }}
                onSave={form => handleEdit(entry.id, form)}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-100">{entry.school}</p>
                  {(entry.degree || entry.field_of_study) && (
                    <p className="text-xs text-zinc-400">
                      {[entry.degree, entry.field_of_study].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div className="flex gap-3 mt-0.5">
                    {entry.gpa && <span className="text-xs text-zinc-600">GPA {entry.gpa}</span>}
                    {entry.graduation_year && <span className="text-xs text-zinc-600">{entry.graduation_year}</span>}
                  </div>
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
          + Add education
        </button>
      )}
    </div>
  )
}
