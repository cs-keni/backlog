import type { DsaAttempt, DsaPhase, DsaLanguage } from '../shared/types'
import type { Difficulty } from '../shared/leetcode-problems'

// ─── Shared constants ─────────────────────────────────────────────────────────
// Both dsa-coach.ts and DsaCompanion.tsx import from here.

export const PHASE_DURATIONS: Record<DsaPhase, Record<Difficulty, number>> = {
  read:        { easy: 2,  medium: 3,  hard: 5  },
  brute_force: { easy: 5,  medium: 8,  hard: 10 },
  pattern:     { easy: 5,  medium: 10, hard: 15 },
  code:        { easy: 10, medium: 15, hard: 25 },
} as const

export const INACTIVITY_THRESHOLD_PERCENT = 70

export const DSA_PHASES: DsaPhase[] = ['read', 'brute_force', 'pattern', 'code']

export const PHASE_LABELS: Record<DsaPhase, string> = {
  read: 'Read',
  brute_force: 'Brute Force',
  pattern: 'Pattern',
  code: 'Code',
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export function dsaStorageKey(tabId: number): string {
  return `dsa_attempt_${tabId}`
}

export async function saveDsaAttempt(tabId: number, attempt: DsaAttempt): Promise<void> {
  try {
    await chrome.storage.local.set({ [dsaStorageKey(tabId)]: attempt })
  } catch { /* storage unavailable */ }
}

export async function clearDsaAttempt(tabId: number): Promise<void> {
  try {
    await chrome.storage.local.remove(dsaStorageKey(tabId))
  } catch { /* storage unavailable */ }
}

export async function loadDsaAttempt(tabId: number): Promise<DsaAttempt | null> {
  try {
    const result = await chrome.storage.local.get(dsaStorageKey(tabId))
    return (result[dsaStorageKey(tabId)] as DsaAttempt | undefined) ?? null
  } catch {
    return null
  }
}

// ─── Attempt helpers ──────────────────────────────────────────────────────────

export function buildAttempt(
  attemptId: string,
  slug: string,
  phase: DsaPhase,
  timeSpentSec: number,
  hintCount: number,
  hintLayersRevealed: number[],
  language: DsaLanguage,
  phaseTimings: Partial<Record<DsaPhase, number>>,
  nudgeCount: number
): DsaAttempt {
  return {
    attempt_id: attemptId,
    problem_slug: slug,
    phase_reached: phase,
    time_spent_sec: timeSpentSec,
    hint_count: hintCount,
    hint_layers_revealed: hintLayersRevealed,
    language,
    phase_timings: phaseTimings,
    nudge_count: nudgeCount,
  }
}
