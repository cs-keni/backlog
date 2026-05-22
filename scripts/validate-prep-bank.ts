#!/usr/bin/env node
/**
 * Validates the integrity of the SD and AI Eng question banks and concept primers.
 *
 * Run:
 *   npx tsx --require ./scripts/mock-server-only.cjs scripts/validate-prep-bank.ts
 *
 * Add to CI before P1 ships.
 */

import { SYSTEM_DESIGN_BANK } from '../src/lib/prep/system-design-bank'
import { AI_ENGINEER_BANK } from '../src/lib/prep/ai-engineer-bank'
import { CONCEPT_PRIMERS } from '../src/lib/prep/concept-primers'
import type { PrepQuestion } from '../src/lib/prep/prep-types'

const DIFFICULTIES = new Set(['junior', 'mid', 'senior'])
const MIN_COMPANY_TAG_LENGTH = 5

type ValidationError = { bank: string; id: string; message: string }
const errors: ValidationError[] = []

function err(bank: string, id: string, message: string) {
  errors.push({ bank, id, message })
}

// ── Validate question banks ──────────────────────────────────────────────────

function validateQuestionBank(
  bank: PrepQuestion[],
  bankName: string,
  idPrefix: string,
  expectedCount: number,
) {
  if (bank.length !== expectedCount) {
    err(bankName, 'bank', `Expected ${expectedCount} questions, found ${bank.length}`)
  }

  const seenIds = new Set<string>()

  for (const q of bank) {
    if (!q.id.startsWith(`${idPrefix}-`)) {
      err(bankName, q.id, `ID must start with "${idPrefix}-", got "${q.id}"`)
    }

    if (seenIds.has(q.id)) {
      err(bankName, q.id, 'Duplicate ID')
    }
    seenIds.add(q.id)

    if (!q.topic || q.topic.trim() === '') {
      err(bankName, q.id, 'Missing topic')
    }
    if (!DIFFICULTIES.has(q.difficulty)) {
      err(bankName, q.id, `Invalid difficulty "${q.difficulty}" — must be junior, mid, or senior`)
    }
    if (!q.prompt || q.prompt.trim().length < 50) {
      err(bankName, q.id, `Prompt too short (${q.prompt?.length ?? 0} chars, min 50)`)
    }
    if (!q.hints || q.hints.length < 2) {
      err(bankName, q.id, `Must have at least 2 hints, found ${q.hints?.length ?? 0}`)
    }
    if (!q.concepts || q.concepts.length < 1) {
      err(bankName, q.id, 'Must have at least 1 concept slug')
    }

    for (const tag of q.companies ?? []) {
      if (tag.length < MIN_COMPANY_TAG_LENGTH) {
        // Warn only — short tags are valid data but won't appear in company spotlight
        console.warn(
          `  ⚠️  [${bankName}] ${q.id}: company tag "${tag}" is < ${MIN_COMPANY_TAG_LENGTH} chars (will be hidden in spotlight)`,
        )
      }
    }

    for (const slug of q.concepts ?? []) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        err(bankName, q.id, `Concept slug "${slug}" must be lowercase kebab-case`)
      }
    }
  }

  // Check no gaps in sequential IDs
  const nums = bank
    .map((q) => parseInt(q.id.split('-')[1], 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b)

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) {
      err(
        bankName,
        'bank',
        `Gap in sequential IDs: ${idPrefix}-${String(nums[i - 1]).padStart(3, '0')} → ${idPrefix}-${String(nums[i]).padStart(3, '0')}`,
      )
    }
  }
}

// ── Validate concept primers ─────────────────────────────────────────────────

function validatePrimers(): Set<string> {
  const seenIds = new Set<string>()

  for (const p of CONCEPT_PRIMERS) {
    if (!p.id || p.id.trim() === '') {
      err('primers', '(unknown)', 'Missing ID')
      continue
    }
    if (seenIds.has(p.id)) {
      err('primers', p.id, 'Duplicate ID')
    }
    seenIds.add(p.id)

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) {
      err('primers', p.id, 'ID must be lowercase kebab-case')
    }
    if (!p.title || p.title.trim() === '') {
      err('primers', p.id, 'Missing title')
    }
    if (!p.summary || p.summary.trim().length < 30) {
      err('primers', p.id, `Summary too short (${p.summary?.length ?? 0} chars, min 30)`)
    }
    if (!p.body || p.body.trim().length < 100) {
      err('primers', p.id, `Body too short (${p.body?.length ?? 0} chars, min 100)`)
    }
    if (!p.keywords || p.keywords.length < 2) {
      err('primers', p.id, 'Must have at least 2 keywords')
    }
  }

  return seenIds
}

// ── Cross-reference: warn on concept slugs with no primer ───────────────────

function checkConceptCoverage(primerIds: Set<string>) {
  const allSlugs = new Set<string>()
  for (const q of [...SYSTEM_DESIGN_BANK, ...AI_ENGINEER_BANK]) {
    for (const slug of q.concepts ?? []) allSlugs.add(slug)
  }

  const missing = [...allSlugs].filter((s) => !primerIds.has(s)).sort()

  if (missing.length > 0) {
    // Warn, not error — missing primers are a UX gap, not a data integrity failure
    console.warn(`\n⚠️  ${missing.length} concept slug(s) have no primer:`)
    for (const s of missing) console.warn(`   - ${s}`)
  } else {
    console.log('✅ All concept slugs have corresponding primers')
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('Validating question banks and concept primers...\n')

validateQuestionBank(SYSTEM_DESIGN_BANK, 'system-design', 'sd', 70)
validateQuestionBank(AI_ENGINEER_BANK, 'ai-engineer', 'ai', 60)
const primerIds = validatePrimers()
checkConceptCoverage(primerIds)

if (errors.length > 0) {
  console.error(`\n❌ ${errors.length} validation error(s):\n`)
  for (const e of errors) {
    console.error(`  [${e.bank}] ${e.id}: ${e.message}`)
  }
  process.exit(1)
} else {
  console.log(
    `\n✅ All validations passed — ${SYSTEM_DESIGN_BANK.length} SD questions, ${AI_ENGINEER_BANK.length} AI Eng questions, ${CONCEPT_PRIMERS.length} primers`,
  )
  process.exit(0)
}
