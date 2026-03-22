import OpenAI from 'openai'
import type { NormalizedJob } from '../llm/normalizer'

const CONCURRENCY = 5
const TIMEOUT_MS = 10_000

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

interface EnrichedData {
  salary_min: number | null
  salary_max: number | null
  description: string | null
  tags: string[]
}

// Enriches NormalizedJob[] with salary + description fetched from each job's URL.
// Runs CONCURRENCY fetches at a time. Individual failures are non-fatal.
export async function enrichJobs(jobs: NormalizedJob[]): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = []

  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY)
    const enriched = await Promise.all(batch.map((job) => enrichJob(job)))
    results.push(...enriched)
    console.log(`[enricher] Enriched ${Math.min(i + CONCURRENCY, jobs.length)}/${jobs.length} jobs`)
  }

  return results
}

async function enrichJob(job: NormalizedJob): Promise<NormalizedJob> {
  try {
    const data = await fetchAndExtract(job.url)
    if (!data) return job

    return {
      ...job,
      // Only fill in fields that are currently absent — never overwrite
      salary_min: job.salary_min ?? data.salary_min,
      salary_max: job.salary_max ?? data.salary_max,
      description: job.description ?? data.description,
      tags: job.tags.length > 0 ? job.tags : data.tags,
    }
  } catch {
    return job
  }
}

async function fetchAndExtract(url: string): Promise<EnrichedData | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) return null

    const html = await res.text()

    // 1. Try JSON-LD structured data (schema.org JobPosting)
    const jsonLdResult = extractFromJsonLd(html)
    if (jsonLdResult) {
      console.log(`[enricher] JSON-LD hit for ${url}`)
      return jsonLdResult
    }

    // 2. Strip HTML to plain text
    const text = stripHtml(html).replace(/\s+/g, ' ').trim()
    if (text.length < 100) {
      console.log(`[enricher] Skipping ${url} — page is JS-rendered (${text.length} chars)`)
      return null
    }

    const capped = text.slice(0, 8000)

    // 3. Regex salary extraction (fast, free)
    const { salary_min, salary_max } = extractSalaryFromText(capped)
    if (salary_min !== null || salary_max !== null) {
      console.log(`[enricher] Regex salary hit for ${url}: ${salary_min}–${salary_max}`)
      return { salary_min, salary_max, description: capped, tags: [] }
    }

    // 4. GPT as last resort — only if we have real content
    if (capped.length < 500) return null
    return await extractWithGpt(capped)
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    if (isTimeout) console.log(`[enricher] Timeout for ${url}`)
    return null
  }
}

function extractFromJsonLd(html: string): EnrichedData | null {
  const scriptBlocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)

  for (const match of scriptBlocks) {
    let data: Record<string, unknown>
    try {
      data = JSON.parse(match[1]) as Record<string, unknown>
    } catch {
      continue
    }

    if (data['@type'] !== 'JobPosting') continue

    const rawDesc = typeof data.description === 'string' ? data.description : ''
    const description = stripHtml(rawDesc).replace(/\s+/g, ' ').trim().slice(0, 8000) || null

    let salary_min: number | null = null
    let salary_max: number | null = null

    const baseSalary = data.baseSalary as Record<string, unknown> | undefined
    if (baseSalary) {
      const value = baseSalary.value as Record<string, unknown> | undefined
      if (value) {
        if (typeof value.minValue === 'number') salary_min = value.minValue
        if (typeof value.maxValue === 'number') salary_max = value.maxValue
        if (typeof value.value === 'number') salary_min = value.value
      }
    }

    // If no salary in JSON-LD, try regex on the description text
    if (salary_min === null && salary_max === null && description) {
      const extracted = extractSalaryFromText(description)
      salary_min = extracted.salary_min
      salary_max = extracted.salary_max
    }

    // Must have either description or salary to be worth returning
    if (!description && salary_min === null && salary_max === null) continue

    // Extract skills/tags from skills or skills-related fields
    const skills = Array.isArray(data.skills) ? (data.skills as unknown[]).map(String) : []

    return { salary_min, salary_max, description, tags: skills.slice(0, 8) }
  }

  return null
}

async function extractWithGpt(text: string): Promise<EnrichedData | null> {
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Extract job details from this posting text. Return JSON with:
  salary_min (number|null), salary_max (number|null),
  description (string — full job description text),
  tags (string[] — up to 8 skills/technologies).
Salary must be annual USD. If hourly rate is given, multiply by 2080.`,
        },
        { role: 'user', content: text },
      ],
    })

    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}') as Partial<EnrichedData>
    return {
      salary_min: typeof parsed.salary_min === 'number' ? parsed.salary_min : null,
      salary_max: typeof parsed.salary_max === 'number' ? parsed.salary_max : null,
      description: typeof parsed.description === 'string' ? parsed.description : null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    }
  } catch {
    return null
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
}

// Extracts salary range from plain text using common patterns.
// Mirrors the same function in src/lib/jobs/url-extractor.ts.
function extractSalaryFromText(text: string): { salary_min: number | null; salary_max: number | null } {
  const dollarRange = text.match(/\$\s*([\d,]+\.?\d*)\s*k?\s*(?:to|–|—|-|\/)\s*\$\s*([\d,]+\.?\d*)\s*k?/i)
  if (dollarRange) {
    const hasK = dollarRange[0].toLowerCase().includes('k')
    const min = parseAmount(dollarRange[1], hasK)
    const max = parseAmount(dollarRange[2], hasK)
    if (min > 1000 && max > 1000) return { salary_min: min, salary_max: max }
  }

  const contextRange = text.match(
    /(?:salary|compensation|pay|wage)[^\n$]*\$\s*([\d,]+\.?\d*)\s*k?\s*(?:to|–|—|-)\s*\$?\s*([\d,]+\.?\d*)\s*k?/i
  )
  if (contextRange) {
    const hasK = contextRange[0].toLowerCase().includes('k')
    const min = parseAmount(contextRange[1], hasK)
    const max = parseAmount(contextRange[2], hasK)
    if (min > 10000 && max > 10000) return { salary_min: min, salary_max: max }
  }

  const singleDollar = text.match(/\$\s*([\d,]+\.?\d*)\s*k?\s*\+/i)
  if (singleDollar) {
    const min = parseAmount(singleDollar[1], singleDollar[0].toLowerCase().includes('k'))
    if (min > 10000) return { salary_min: min, salary_max: null }
  }

  return { salary_min: null, salary_max: null }
}

function parseAmount(raw: string, forceK = false): number {
  const n = parseFloat(raw.replace(/,/g, ''))
  if (isNaN(n)) return 0
  return forceK && n < 1000 ? n * 1000 : n
}
