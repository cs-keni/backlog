#!/usr/bin/env node
/**
 * Seeds the public.projects table from the structured markdown files in
 * projects-data/. Each file maps to one project row with rich AI context.
 *
 * Requires migration 042_application_materials.sql to be applied first
 * (adds detailed_description, impact, is_active columns + unique index).
 * If the migration has not been applied, the script falls back to base
 * columns only and warns.
 *
 * Run with:
 *   node --env-file=.env.local scripts/seed-project-catalog.mjs
 *
 * Safe to re-run — upserts on (user_id, name).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'projects-data')
const USER_EMAIL = 'kenny.hn.nguyen@gmail.com'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Markdown parsers ──────────────────────────────────────────────────────

/** Returns the trimmed text of a section between `## heading` and the next `##`. */
function getSection(content, heading) {
  const re = new RegExp(`^## ${heading.replace(/[/()]/g, '\\$&')}\\s*$`, 'm')
  const start = content.search(re)
  if (start === -1) return null
  const afterHeading = content.indexOf('\n', start) + 1
  const nextHeading  = content.indexOf('\n## ', afterHeading)
  const raw = nextHeading === -1
    ? content.slice(afterHeading)
    : content.slice(afterHeading, nextHeading)
  return raw.trim() || null
}

/** `# ProjectName — subtitle` → `ProjectName` */
function parseName(content) {
  const m = content.match(/^# (.+?)(?:\s+[—–]\s+.+)?$/m)
  return m ? m[1].trim() : null
}

/** `## One-Line Pitch` → first paragraph */
function parseDescription(content) {
  const s = getSection(content, 'One-Line Pitch')
  return s ? s.split('\n\n')[0].trim() : null
}

/** `## What Was Built` → first paragraph before any `### ` sub-heading */
function parseDetailedDescription(content) {
  const s = getSection(content, 'What Was Built')
  if (!s) return null
  const sub = s.indexOf('\n### ')
  return (sub === -1 ? s : s.slice(0, sub)).split('\n\n')[0].trim() || null
}

/**
 * `## Tech Stack` bullet list → string[].
 * Lines like `- **Backend:** Java 21, Spring Boot 3.x, PostgreSQL` become
 * ["Java 21", "Spring Boot", "PostgreSQL"] with versions stripped.
 */
function parseTechStack(content) {
  const s = getSection(content, 'Tech Stack')
  if (!s) return []
  const techs = new Set()
  for (const line of s.split('\n')) {
    if (!line.startsWith('-')) continue
    // Find the "**Category:**" label and take everything after it.
    // Markdown format is "**Category:**" — colon is inside the bold, before "**".
    // So we search for ":**" (colon + closing bold markers).
    const boldEnd = line.indexOf(':**')
    const value = boldEnd >= 0
      ? line.slice(boldEnd + 3).trim()   // skip ":**" and leading space
      : line.replace(/^-\s*/, '').trim()
    if (!value || value.startsWith('*')) continue
    // Strip all parentheticals before splitting — avoids comma-inside-paren splits.
    const cleaned = value.replace(/\s*\([^)]*\)/g, '').trim()
    for (let tech of cleaned.split(',')) {
      // Strip trailing version numbers: "21", "3.x", "0.12", "18", "4.5"
      tech = tech.replace(/\s+[\d]+(\.\w+)*$/, '').trim()
      tech = tech.replace(/\s+/g, ' ').trim()
      if (tech && tech.length >= 2 && tech.length <= 50 && !tech.startsWith('*')) {
        techs.add(tech)
      }
    }
  }
  return [...techs].filter(Boolean).slice(0, 20)
}

/** `## Measurable Outcomes / Impact` bullet list → joined string for the `impact` column */
function parseImpact(content) {
  const s = getSection(content, 'Measurable Outcomes / Impact')
    ?? getSection(content, 'Measurable Outcomes')
  if (!s) return null
  const bullets = s.split('\n')
    .filter(l => l.startsWith('- '))
    .map(l => l.replace(/^-\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .slice(0, 4)
  return bullets.join(' | ') || null
}

/** Same section as impact but as string[] for the `highlights` column */
function parseHighlights(content) {
  const s = getSection(content, 'Measurable Outcomes / Impact')
    ?? getSection(content, 'Measurable Outcomes')
  if (!s) return []
  return s.split('\n')
    .filter(l => l.startsWith('- '))
    .map(l => l.replace(/^-\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .slice(0, 4)
}

/** `## Status` → first GitHub URL */
function parseGithubUrl(content) {
  const s = getSection(content, 'Status')
  if (!s) return null
  const m = s.match(/\(https:\/\/github\.com\/[^)]+\)/)
  return m ? m[0].slice(1, -1) : null
}

/** Detect 4-person Scrum team (Syllabify) → role = "Team Member", else "Lead Developer" */
function parseRole(content) {
  return /\d+-person\s+(Scrum|team)/i.test(content) ? 'Team Member' : 'Lead Developer'
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  // Resolve user ID from email
  const { data: { users }, error: userErr } = await admin.auth.admin.listUsers()
  if (userErr) { console.error('listUsers failed:', userErr.message); process.exit(1) }
  const user = users.find(u => u.email === USER_EMAIL)
  if (!user) { console.error(`User ${USER_EMAIL} not found in auth.users`); process.exit(1) }
  const userId = user.id
  console.log(`Seeding for: ${USER_EMAIL} (${userId})\n`)

  // Check if migration 042 columns exist
  const { error: colCheck } = await admin.from('projects').select('detailed_description').limit(1)
  const hasMig042 = !colCheck
  if (!hasMig042) {
    console.warn('⚠  Migration 042 not yet applied — detailed_description/impact/is_active columns are missing.')
    console.warn('   Apply supabase/migrations/042_application_materials.sql, then re-run this script.')
    console.warn('   Proceeding with base columns only (name, description, tech_stack, url, highlights).\n')
  }

  const files = readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.md') && f !== 'INDEX.md')
    .sort()

  console.log(`Parsing ${files.length} files: ${files.map(f => f.replace('.md', '')).join(', ')}\n`)

  const errors = []

  for (const [i, file] of files.entries()) {
    const content = readFileSync(join(DATA_DIR, file), 'utf-8')
    const name = parseName(content)

    if (!name) {
      console.warn(`  ✗ [${file}] Could not parse project name — skipping`)
      errors.push({ file, error: 'Could not parse name' })
      continue
    }

    const row = {
      user_id:      userId,
      name,
      description:  parseDescription(content) ?? '',
      role:         parseRole(content),
      tech_stack:   parseTechStack(content),
      url:          parseGithubUrl(content),
      highlights:   parseHighlights(content),
      display_order: i,
      ...(hasMig042 && {
        detailed_description: parseDetailedDescription(content),
        impact:               parseImpact(content),
        is_active:            true,
      }),
    }

    // Upsert on (user_id, name) — requires the unique index from migration 042
    // Falls back to delete-then-insert if the index isn't present yet
    let upsertError = null
    if (hasMig042) {
      const { error } = await admin
        .from('projects')
        .upsert(row, { onConflict: 'user_id,name' })
      upsertError = error
    } else {
      // Pre-042: check-then-update/insert manually
      const { data: existing } = await admin
        .from('projects')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name)
        .single()

      if (existing) {
        const { error } = await admin.from('projects').update(row).eq('id', existing.id)
        upsertError = error
      } else {
        const { error } = await admin.from('projects').insert(row)
        upsertError = error
      }
    }

    if (upsertError) {
      console.error(`  ✗ ${name}: ${upsertError.message}`)
      errors.push({ name, error: upsertError.message })
    } else {
      const stack = row.tech_stack.slice(0, 3).join(', ')
      console.log(`  ✓ ${name.padEnd(20)} [${stack}...]`)
    }
  }

  console.log(`\n${files.length - errors.length}/${files.length} projects upserted.`)
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`, errors)
    process.exit(1)
  }
  console.log('\nDone. The project catalog is ready for resume tailoring.')
}

main()
