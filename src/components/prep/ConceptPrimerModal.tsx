'use client'

import { useEffect, useRef } from 'react'
import type { ConceptPrimer } from '@/lib/prep/prep-types'

interface ConceptPrimerModalProps {
  primer: ConceptPrimer
  onClose: () => void
}

function renderMarkdown(body: string) {
  return body.split('\n').map((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return <div key={index} className="h-2" />
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      return (
        <h4 key={index} className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {trimmed.replaceAll('**', '')}
        </h4>
      )
    }
    if (trimmed.startsWith('- ')) {
      return (
        <p key={index} className="pl-3 text-sm leading-6 text-zinc-300">
          <span className="text-zinc-500">• </span>{trimmed.slice(2).replaceAll('**', '')}
        </p>
      )
    }
    return (
      <p key={index} className="text-sm leading-6 text-zinc-300">
        {trimmed.replaceAll('**', '')}
      </p>
    )
  })
}

export function ConceptPrimerModal({ primer, onClose }: ConceptPrimerModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="concept-primer-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-950 px-5 py-4">
          <div>
            <h3 id="concept-primer-title" className="text-sm font-semibold text-zinc-100">
              {primer.title}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">{primer.summary}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
          >
            Close
          </button>
        </div>
        <div className="space-y-1 px-5 py-4">{renderMarkdown(primer.body)}</div>
        <div className="border-t border-zinc-800 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {primer.keywords.map((keyword) => (
              <span key={keyword} className="rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
