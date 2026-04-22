'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

export interface Suggestion {
  value: string
  meta?: string
}

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  fetchSuggestions: (query: string) => Promise<Suggestion[]>
  placeholder?: string
  inputClassName?: string
  debounceMs?: number
  autoFocus?: boolean
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-zinc-100 font-medium">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

export function Combobox({
  value,
  onChange,
  fetchSuggestions,
  placeholder,
  inputClassName,
  debounceMs = 150,
  autoFocus,
}: ComboboxProps) {
  const [mounted, setMounted] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  function updatePosition() {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
      zIndex: 9999,
    })
  }

  function scheduleFetch(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(q).then((results) => {
        setSuggestions(results)
        setHighlighted(-1)
        if (results.length === 0) setOpen(false)
      })
    }, debounceMs)
  }

  function handleFocus() {
    updatePosition()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    void fetchSuggestions(value).then((results) => {
      setSuggestions(results)
      if (results.length > 0) setOpen(true)
    })
  }

  function handleBlur() {
    // Delay so mousedown on a suggestion fires first
    setTimeout(() => setOpen(false), 150)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    onChange(q)
    updatePosition()
    scheduleFetch(q)
    setOpen(true)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setOpen(true)
        setHighlighted(0)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => (h <= 0 ? 0 : h - 1))
    } else if (e.key === 'Enter') {
      if (highlighted >= 0 && suggestions[highlighted]) {
        e.preventDefault()
        select(suggestions[highlighted].value)
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
    }
  }

  function select(val: string) {
    onChange(val)
    setOpen(false)
    setHighlighted(-1)
  }

  const dropdown =
    mounted && open && suggestions.length > 0
      ? createPortal(
          <AnimatePresence>
            <motion.ul
              key="combobox-dropdown"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              style={dropdownStyle}
              className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
              role="listbox"
              onMouseDown={(e) => e.preventDefault()}
            >
              {suggestions.map((s, i) => (
                <motion.li
                  key={s.value}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.012 }}
                  onClick={() => select(s.value)}
                  onMouseEnter={() => setHighlighted(i)}
                  role="option"
                  aria-selected={i === highlighted}
                  className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                    i === highlighted
                      ? 'bg-zinc-700/80 text-zinc-100'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span>
                    <HighlightMatch text={s.value} query={value} />
                  </span>
                  {s.meta && (
                    <span className="text-[10px] text-zinc-500 ml-3 shrink-0">{s.meta}</span>
                  )}
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>,
          document.body
        )
      : null

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={inputClassName}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />
      {dropdown}
    </div>
  )
}
