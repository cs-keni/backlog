/**
 * Utilities for pre-processing resume.lol markdown and parsing it into
 * structured sections that @react-pdf/renderer templates can consume.
 */

// ─── Pre-processor ────────────────────────────────────────────────────────────

/**
 * Strips resume.lol-specific syntax (front matter, HTML tags, variable refs)
 * and returns clean plain-markdown suitable for PDF rendering and Claude input.
 *
 * The <span class="spacer"></span> that right-aligns dates in resume.lol is
 * replaced with " | " so the date becomes the last pipe-delimited segment of
 * the heading line — parseable by splitEntryHeading() below.
 */
export function preprocessResumeLol(raw: string): string {
  let s = raw

  // Strip the HTML comment block at the top
  s = s.replace(/<!--[\s\S]*?-->/g, '')

  // Extract @VAR=value front-matter into a map, then remove the lines
  const vars: Record<string, string> = {}
  s = s.replace(/^@(\w+)=(.+)$/gm, (_, key: string, val: string) => {
    vars[key] = val.trim()
    return ''
  })

  // Substitute {VAR} placeholders
  s = s.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)

  // Replace spacer spans with a pipe separator (date goes after last |)
  s = s.replace(/<span[^>]*class="spacer"[^>]*><\/span>/gi, ' | ')

  // Strip all remaining HTML tags
  s = s.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  s = s
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')

  // Collapse 3+ blank lines to 2
  s = s.replace(/\n{3,}/g, '\n\n').trim()

  return s
}

// ─── Structured types ─────────────────────────────────────────────────────────

export interface ResumeHeader {
  name: string
  contacts: string[]
}

export interface BulletEntry {
  heading:  string
  date:     string | null
  bullets:  string[]
}

export interface ResumeSection {
  title:   string
  entries: BulletEntry[]
  /** Raw text lines (for sections like Skills that aren't entry-based) */
  lines:   string[]
}

export interface ParsedResume {
  header:   ResumeHeader
  sections: ResumeSection[]
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const DATE_SEGMENT = /^[A-Za-z]+\s+\d{4}(\s*[—–-]\s*([A-Za-z]+\s+\d{4}|[Pp]resent))?$/

/**
 * Splits a level-3 heading into [entryTitle, date | null].
 * The date is the last pipe-delimited segment if it matches a date pattern.
 * E.g. "Software Engineer Intern | EpiBuild | Jan 2025 — Apr 2026"
 *   → { heading: "Software Engineer Intern | EpiBuild", date: "Jan 2025 — Apr 2026" }
 */
export function splitEntryHeading(raw: string): { heading: string; date: string | null } {
  const parts = raw.split('|').map(p => p.trim())
  if (parts.length >= 2 && DATE_SEGMENT.test(parts[parts.length - 1])) {
    const date = parts.pop()!
    return { heading: parts.join(' | '), date }
  }
  return { heading: raw, date: null }
}

/**
 * Parses pre-processed (plain) resume markdown into structured sections.
 */
export function parseResume(markdown: string): ParsedResume {
  const lines = markdown.split('\n')

  const header: ResumeHeader = { name: '', contacts: [] }
  const sections: ResumeSection[] = []

  let inHeader = false
  let currentSection: ResumeSection | null = null
  let currentEntry: BulletEntry | null = null

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.startsWith('# ')) {
      header.name = line.slice(2).trim()
      inHeader = true
      continue
    }

    if (inHeader && line.startsWith('- ')) {
      // Strip markdown links [text](url) → text; strip URLs
      const text = line.slice(2).trim().replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      header.contacts.push(text)
      continue
    }

    if (line.startsWith('## ')) {
      inHeader = false
      if (currentEntry && currentSection) currentSection.entries.push(currentEntry)
      currentEntry = null
      if (currentSection) sections.push(currentSection)
      currentSection = { title: line.slice(3).trim(), entries: [], lines: [] }
      continue
    }

    if (line.startsWith('### ') && currentSection) {
      if (currentEntry) currentSection.entries.push(currentEntry)
      const { heading, date } = splitEntryHeading(line.slice(4).trim())
      currentEntry = { heading, date, bullets: [] }
      continue
    }

    if (line.startsWith('- ') && currentEntry) {
      currentEntry.bullets.push(line.slice(2).trim())
      continue
    }

    // Skills / plain text lines inside a section (not under an entry)
    if (line.startsWith('- ') && currentSection && !currentEntry) {
      currentSection.lines.push(line.slice(2).trim())
      continue
    }
  }

  if (currentEntry && currentSection) currentSection.entries.push(currentEntry)
  if (currentSection) sections.push(currentSection)

  return { header, sections }
}
