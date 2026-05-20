'use client'

import { motion } from 'framer-motion'
import type { InterviewGuide } from '@/lib/llm/question-generator'

export function CulturalSignals({ guide }: { guide: InterviewGuide }) {
  return (
    <motion.div
      key="culture"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-4"
    >
      {guide.cultural_signals.values.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Core Values They Screen For</p>
          <div className="flex flex-wrap gap-1.5">
            {guide.cultural_signals.values.map((v, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs text-zinc-300 border border-zinc-700">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {guide.cultural_signals.terminology.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Know These Terms</p>
          <div className="flex flex-wrap gap-1.5">
            {guide.cultural_signals.terminology.map((t, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {guide.cultural_signals.avoid.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Anti-Patterns to Avoid</p>
          {guide.cultural_signals.avoid.map((a, i) => (
            <div key={i} className="flex gap-2 rounded-lg border border-red-900/30 bg-red-950/20 px-3 py-2">
              <span className="text-red-500 text-xs shrink-0 mt-0.5">x</span>
              <p className="text-xs text-zinc-400 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

