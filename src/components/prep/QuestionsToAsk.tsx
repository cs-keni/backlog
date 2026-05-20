'use client'

import { motion } from 'framer-motion'
import type { InterviewGuide } from '@/lib/llm/question-generator'

export function QuestionsToAsk({ guide }: { guide: InterviewGuide }) {
  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-4"
    >
      {guide.overview && <p className="text-xs text-zinc-400 leading-relaxed">{guide.overview}</p>}

      {guide.rounds.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Rounds</p>
          {guide.rounds.map((round, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
              <span className="text-xs text-zinc-600 shrink-0 w-4 mt-0.5">{i + 1}.</span>
              <div>
                <p className="text-xs font-medium text-zinc-300">{round.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{round.focus}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {guide.questions_to_ask.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Ask Your Interviewer</p>
          {guide.questions_to_ask.map((q, i) => (
            <div key={i} className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-3 py-2.5">
              <p className="text-xs text-zinc-400 leading-relaxed">{q}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

