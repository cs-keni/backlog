import type { NormalizedJob } from '../llm/normalizer'

const BASE_URL = 'https://boards-api.greenhouse.io/v1/boards'
const TIMEOUT_MS = 10_000

interface GreenhouseJob {
  id: number
  title: string
  updated_at: string
  absolute_url: string
  location: { name: string }
  departments?: Array<{ name: string }>
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[]
}

// Fetch all active jobs for a company from the Greenhouse public API.
// Returns [] if the slug is invalid or the request fails — errors are non-fatal.
export async function fetchGreenhouseJobs(
  companyName: string,
  slug: string,
): Promise<NormalizedJob[]> {
  const url = `${BASE_URL}/${slug}/jobs?content=true`

  let data: GreenhouseResponse
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; backlog-bot/1.0)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      if (res.status !== 404) {
        console.warn(`[greenhouse] ${companyName} (${slug}): HTTP ${res.status}`)
      }
      return []
    }

    data = await res.json() as GreenhouseResponse
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.warn(`[greenhouse] ${companyName} (${slug}): ${isTimeout ? 'timeout' : String(err)}`)
    return []
  }

  const jobs: NormalizedJob[] = (data.jobs ?? []).map((job) => {
    const loc = job.location?.name ?? null
    const isRemote = loc ? /remote|anywhere/i.test(loc) : false

    return {
      title: job.title,
      company: companyName,
      location: loc,
      country: inferCountry(loc),
      is_remote: isRemote,
      salary_min: null,
      salary_max: null,
      experience_level: inferExperienceLevel(job.title),
      tags: inferTags(job.title, job.departments),
      url: job.absolute_url,
      posted_at: job.updated_at ?? null,
      description: null, // Greenhouse full descriptions require a second API call per job — backfiller will handle
    }
  })

  console.log(`[greenhouse] ${companyName}: fetched ${jobs.length} jobs`)
  return jobs
}

function inferCountry(location: string | null): string | null {
  if (!location) return null
  const loc = location.toLowerCase()
  if (/remote|anywhere/i.test(loc)) return 'United States' // safe default
  if (/\b(uk|united kingdom|london|manchester|edinburgh)\b/i.test(loc)) return 'United Kingdom'
  if (/\b(canada|toronto|vancouver|montreal)\b/i.test(loc)) return 'Canada'
  if (/\b(germany|berlin|munich|hamburg)\b/i.test(loc)) return 'Germany'
  if (/\b(france|paris)\b/i.test(loc)) return 'France'
  if (/\b(australia|sydney|melbourne)\b/i.test(loc)) return 'Australia'
  if (/\b(singapore)\b/i.test(loc)) return 'Singapore'
  if (/\b(india|bangalore|bengaluru|mumbai|hyderabad)\b/i.test(loc)) return 'India'
  // Default: US (most portal companies are US-based)
  return 'United States'
}

function inferExperienceLevel(title: string): string | null {
  const t = title.toLowerCase()
  if (/new grad|university graduate|entry.?level|junior/.test(t)) return 'entry'
  if (/senior|staff|principal|lead/.test(t)) return 'senior'
  if (/\b(ii|2|mid|middle)\b/.test(t)) return 'mid'
  return null
}

function inferTags(title: string, departments?: Array<{ name: string }>): string[] {
  const tags: string[] = []
  const text = [title, ...(departments ?? []).map(d => d.name)].join(' ').toLowerCase()

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
