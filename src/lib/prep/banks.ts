import 'server-only'

import { AI_ENGINEER_BANK } from './ai-engineer-bank'
import { CONCEPT_PRIMERS } from './concept-primers'
import type { ConceptPrimer, PrepQuestion } from './prep-types'
import { SYSTEM_DESIGN_BANK } from './system-design-bank'

export type PrepBank = 'system-design' | 'ai-engineer'
export type QuestionStatus = 'unstudied' | 'studied' | 'needs-review'

export const VALID_BANKS: PrepBank[] = ['system-design', 'ai-engineer']
export const VALID_STATUSES: QuestionStatus[] = ['unstudied', 'studied', 'needs-review']

export function isPrepBank(value: unknown): value is PrepBank {
  return typeof value === 'string' && VALID_BANKS.includes(value as PrepBank)
}

export function isQuestionStatus(value: unknown): value is QuestionStatus {
  return typeof value === 'string' && VALID_STATUSES.includes(value as QuestionStatus)
}

export function getQuestionBank(bank: PrepBank): PrepQuestion[] {
  return bank === 'system-design' ? SYSTEM_DESIGN_BANK : AI_ENGINEER_BANK
}

export function getAllQuestions(): PrepQuestion[] {
  return [...SYSTEM_DESIGN_BANK, ...AI_ENGINEER_BANK]
}

export function getPrimers(): ConceptPrimer[] {
  return CONCEPT_PRIMERS
}

export function getQuestionById(bank: PrepBank, questionId: string): PrepQuestion | null {
  return getQuestionBank(bank).find((question) => question.id === questionId) ?? null
}

export function inferBankFromQuestionId(questionId: string): PrepBank | null {
  if (questionId.startsWith('sd-')) return 'system-design'
  if (questionId.startsWith('ai-')) return 'ai-engineer'
  return null
}
