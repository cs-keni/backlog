import OpenAI from 'openai'
import type { RawJobEntry } from '../github/parser'

export interface NormalizedJob {
  title: string
  company: string
  location: string | null
  is_remote: boolean
  salary_min: number | null
  salary_max: number | null
  experience_level: string | null // "entry" | "mid" | "senior" | null
  tags: string[]
  url: string
  posted_at: string | null // ISO 8601
}

const BATCH_SIZE = 20

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

// Normalizes raw parsed entries in batches of BATCH_SIZE to minimize API call overhead.
export async function normalizeEntries(rawEntries: RawJobEntry[]): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = []

  for (let i = 0; i < rawEntries.length; i += BATCH_SIZE) {
    const batch = rawEntries.slice(i, i + BATCH_SIZE)
    const normalized = await normalizeBatch(batch)
    results.push(...normalized)
    console.log(`[normalizer] Normalized ${results.length}/${rawEntries.length} entries`)
  }

  return results
}

async function normalizeBatch(entries: RawJobEntry[]): Promise<NormalizedJob[]> {
  const entriesText = entries
    .map(
      (e, i) =>
        `${i + 1}. Company: ${e.company} | Title: ${e.title} | Location: ${e.location} | Date: ${e.rawDate}`
    )
    .join('\n')

  const prompt = `Normalize these job listing entries into structured JSON. Return a JSON object with a "jobs" array containing exactly ${entries.length} objects in the same order as the input.

Each object must have these fields:
- "title": string — cleaned job title
- "company": string — company name
- "location": string | null — primary location (null if truly unknown)
- "is_remote": boolean — true if the role is remote or hybrid
- "salary_min": number | null — annual USD minimum salary if mentioned, otherwise null
- "salary_max": number | null — annual USD maximum salary if mentioned, otherwise null
- "experience_level": "entry" | "mid" | "senior" | null — infer from title; "New Grad", "University Graduate", "Entry Level" → "entry"; null if unclear
- "tags": string[] — up to 5 relevant skill or domain tags (e.g. ["backend", "python", "ml"])

Input entries:
${entriesText}

Return ONLY the JSON object, no markdown, no explanation.`

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
    })

    const content = response.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(content) as { jobs?: unknown[] }
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : []

    return entries.map((raw, i) => {
      const item = jobs[i] as Record<string, unknown> | undefined
      if (!item) return fallbackNormalize(raw)

      return {
        title: typeof item.title === 'string' ? item.title : raw.title,
        company: typeof item.company === 'string' ? item.company : raw.company,
        location: typeof item.location === 'string' ? item.location : null,
        is_remote: Boolean(item.is_remote),
        salary_min: typeof item.salary_min === 'number' ? item.salary_min : null,
        salary_max: typeof item.salary_max === 'number' ? item.salary_max : null,
        experience_level: typeof item.experience_level === 'string' ? item.experience_level : null,
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        url: raw.url,
        posted_at: parsePostedDate(raw.rawDate),
      }
    })
  } catch (err) {
    console.error('[normalizer] GPT batch failed, falling back to raw data:', err)
    return entries.map(fallbackNormalize)
  }
}

function fallbackNormalize(raw: RawJobEntry): NormalizedJob {
  const loc = raw.location.toLowerCase()
  return {
    title: raw.title,
    company: raw.company,
    location: raw.location || null,
    is_remote: loc.includes('remote') || loc.includes('hybrid'),
    salary_min: null,
    salary_max: null,
    experience_level: inferExperienceLevel(raw.title),
    tags: [],
    url: raw.url,
    posted_at: parsePostedDate(raw.rawDate),
  }
}

function inferExperienceLevel(title: string): string | null {
  const t = title.toLowerCase()
  if (
    t.includes('new grad') ||
    t.includes('university graduate') ||
    t.includes('entry level') ||
    t.includes('entry-level') ||
    t.includes('junior')
  ) {
    return 'entry'
  }
  if (t.includes('senior') || t.includes('staff') || t.includes('principal')) return 'senior'
  if (t.includes('mid') || t.includes('ii') || t.includes('level 2')) return 'mid'
  return null
}

// Parses the job posting date from two possible formats:
//
//   New format: "0d", "1d", "7d", "30d" — days ago (current README format)
//   Legacy format: "Sep 5", "Aug 12" — month + day (older README format)
//
// Returns an ISO 8601 string, or null if unparseable.
export function parsePostedDate(rawDate: string): string | null {
  if (!rawDate) return null

  // New format: Xd (days ago)
  const daysMatch = rawDate.match(/^(\d+)d$/i)
  if (daysMatch) {
    const daysAgo = parseInt(daysMatch[1], 10)
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  // Legacy format: "Sep 5", "Aug 12"
  // Year inference: if the month is strictly after the current month, assume last year.
  const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  }

  const match = rawDate.match(/([A-Za-z]+)\s+(\d+)/)
  if (!match) return null

  const monthKey = match[1].toLowerCase().slice(0, 3)
  const day = parseInt(match[2], 10)
  const monthIndex = MONTHS[monthKey]
  if (monthIndex === undefined || isNaN(day)) return null

  const now = new Date()
  const year = monthIndex > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear()

  return new Date(year, monthIndex, day).toISOString()
}
