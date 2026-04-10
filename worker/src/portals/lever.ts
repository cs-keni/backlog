import type { NormalizedJob } from '../llm/normalizer'

const BASE_URL = 'https://api.lever.co/v0/postings'
const TIMEOUT_MS = 10_000

interface LeverPosting {
  id: string
  text: string          // job title
  createdAt: number     // Unix ms
  hostedUrl: string
  categories: {
    location?: string
    team?: string
    commitment?: string // "Full-time" | "Part-time" | "Internship"
    level?: string
  }
  description?: string
  descriptionPlain?: string
  salaryRange?: {
    min?: number
    max?: number
        currency?: string
  }
}

// Fetch all active job postings for a company from the Lever public API.
// Returns [] if the slug is invalid or the request fails — errors are non-fatal.
export async function fetchLeverJobs(
  companyName: string,
  slug: string,
): Promise<NormalizedJob[]> {
  const url = `${BASE_URL}/${slug}?mode=json`

  let postings: LeverPosting[]
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; backlog-bot/1.0)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      if (res.status !== 404) {
        console.warn(`[lever] ${companyName} (${slug}): HTTP ${res.status}`)
      }
      return []
    }

    postings = await res.json() as LeverPosting[]
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.warn(`[lever] ${companyName} (${slug}): ${isTimeout ? 'timeout' : String(err)}`)
    return []
  }

  // Filter to full-time roles only (skip part-time, internships from portals — SimplifyJobs handles internships)
  const fullTime = postings.filter(p => {
    const commitment = p.categories?.commitment?.toLowerCase() ?? ''
    return !commitment || commitment === 'full-time' || commitment === 'full time'
  })

  const jobs: NormalizedJob[] = fullTime.map((posting) => {
    const loc = posting.categories?.location ?? null
    const isRemote = loc ? /remote|anywhere/i.test(loc) : false

    // Lever salary ranges are in USD cents or raw dollars depending on the company
    const salaryRange = posting.salaryRange
    const salary_min = salaryRange?.min && salaryRange.min > 0 ? normalizeSalary(salaryRange.min) : null
    const salary_max = salaryRange?.max && salaryRange.max > 0 ? normalizeSalary(salaryRange.max) : null

    // Lever returns description as HTML; strip tags for storage
    const rawDesc = posting.descriptionPlain ?? posting.description ?? null
    const description = rawDesc ? stripHtml(rawDesc).slice(0, 8000) : null

    return {
      title: posting.text,
      company: companyName,
      location: loc,
      country: inferCountry(loc),
      is_remote: isRemote,
      salary_min,
      salary_max,
      experience_level: inferExperienceLevel(posting.text, posting.categories?.level),
      tags: inferTags(posting.text, posting.categories?.team),
      url: posting.hostedUrl,
      posted_at: posting.createdAt ? new Date(posting.createdAt).toISOString() : null,
      description,
    }
  })

  console.log(`[lever] ${companyName}: fetched ${jobs.length} jobs (${postings.length - fullTime.length} non-full-time skipped)`)
  return jobs
}

// Lever sometimes stores salaries in cents (e.g. 15000000 = $150k), sometimes in dollars.
// Heuristic: if the value is > 500_000 treat it as cents.
function normalizeSalary(value: number): number {
  return value > 500_000 ? Math.round(value / 100) : value
}

function inferCountry(location: string | null): string | null {
  if (!location) return null
  if (/remote|anywhere/i.test(location)) return 'United States'
  if (/\b(uk|united kingdom|london|manchester|edinburgh)\b/i.test(location)) return 'United Kingdom'
  if (/\b(canada|toronto|vancouver|montreal)\b/i.test(location)) return 'Canada'
  if (/\b(germany|berlin|munich|hamburg)\b/i.test(location)) return 'Germany'
  if (/\b(france|paris)\b/i.test(location)) return 'France'
  if (/\b(australia|sydney|melbourne)\b/i.test(location)) return 'Australia'
  if (/\b(singapore)\b/i.test(location)) return 'Singapore'
  if (/\b(india|bangalore|bengaluru|mumbai|hyderabad)\b/i.test(location)) return 'India'
  return 'United States'
}

function inferExperienceLevel(title: string, level?: string): string | null {
  const t = title.toLowerCase()
  const l = (level ?? '').toLowerCase()
  if (/new grad|university graduate|entry.?level|junior/.test(t) || /entry|junior/.test(l)) return 'entry'
  if (/senior|staff|principal|lead/.test(t) || /senior/.test(l)) return 'senior'
  if (/\b(ii|2|mid|middle)\b/.test(t)) return 'mid'
  return null
}

function inferTags(title: string, team?: string): string[] {
  const tags: string[] = []
  const text = [title, team ?? ''].join(' ').toLowerCase()

  if (/frontend|front.?end|react|ui|web/.test(text)) tags.push('frontend')
  if (/backend|back.?end|api|server/.test(text)) tags.push('backend')
  if (/fullstack|full.?stack/.test(text)) tags.push('fullstack')
  if (/machine learning|ml|ai|deep learning/.test(text)) tags.push('ml')
  if (/data science|data scientist/.test(text)) tags.push('data-science')
  if (/data engineer/.test(text)) tags.push('data-engineering')
  if (/platform|infrastructure|devops|sre|reliability/.test(text)) tags.push('platform')
  if (/security|appsec|infosec/.test(text)) tags.push('security')
  if (/mobile|ios|android/.test(text)) tags.push('mobile')
  if (/embedded|firmware|hardware/.test(text)) tags.push('embedded')

  return tags.slice(0, 5)
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
    .replace(/\s+/g, ' ')
    .trim()
}
