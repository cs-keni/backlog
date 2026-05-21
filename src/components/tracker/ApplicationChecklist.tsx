'use client'

import type { ApplicationChecklistItem } from '@/lib/tracker/application-checklist'

interface ApplicationChecklistProps {
  items: ApplicationChecklistItem[]
}

export function ApplicationChecklist({ items }: ApplicationChecklistProps) {
  const done = items.filter((item) => item.done).length

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Application Packet
        </h3>
        <span className="text-[11px] text-zinc-500">{done}/{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item.label}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              item.done
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {item.done ? '✓ ' : ''}{item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
