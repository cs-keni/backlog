'use client'

import { useState, useRef, KeyboardEvent } from 'react'

interface SkillsInputProps {
  skills: string[]
  onChange: (skills: string[]) => void
}

export function SkillsInput({ skills, onChange }: SkillsInputProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addSkill(raw: string) {
    const skill = raw.trim()
    if (!skill || skills.includes(skill)) {
      setInput('')
      return
    }
    onChange([...skills, skill])
    setInput('')
  }

  function removeSkill(skill: string) {
    onChange(skills.filter(s => s !== skill))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addSkill(input)
    } else if (e.key === 'Backspace' && !input && skills.length > 0) {
      removeSkill(skills[skills.length - 1])
    }
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[2.5rem] px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 focus-within:border-zinc-600 transition-colors cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {skills.map(skill => (
        <span
          key={skill}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-xs text-zinc-200"
        >
          {skill}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeSkill(skill) }}
            className="text-zinc-500 hover:text-zinc-300 transition-colors leading-none"
            aria-label={`Remove ${skill}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addSkill(input) }}
        placeholder={skills.length === 0 ? 'Type a skill and press Enter…' : ''}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
      />
    </div>
  )
}
