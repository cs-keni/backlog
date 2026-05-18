import type { NormalizedJob } from '../llm/normalizer'

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search'
const DEFAULT_QUERY_LIMIT = 8
const RESULTS_PER_QUERY = 10
const REQUEST_TIMEOUT_MS = 10_000

const SEARCH_QUERIES = [
  'site:jobs.lever.co "new grad software engineer"',
  'site:boards.greenhouse.io "new grad software engineer"',
  'site:job-boards.greenhouse.io "new grad software engineer"',
  'site:jobs.lever.co "junior software engineer"',
  'site:boards.greenhouse.io "junior software engineer"',
  '"associate software engineer" "careers"',
  '"entry level software engineer" "careers"',
  '"early career software engineer" "careers"',
  '"AI software engineer" "early career"',
  '"applied AI engineer" "entry level"',
  '"LLM software engineer" "new grad"',
]

const JOB_BOARD_HOST_BLOCKLIST = [
  'indeed.com',
  'linkedin.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'monster.com',
  'builtin.com',
  'levels.fyi',
  'reddit.com',
]

interface BraveSearchResponse {
  web?: {
    results?: BraveSearchResult[]
  }
}

interface BraveSearchResult {
  title?: string
  url?: string
  description?: string
  extra_snippets?: string[]
}

interface ExtractedJob {
  title: string
  company: string
  location: string | null
  country: string | null
  salary_min: number | null
  salary_max: number | null
  description: string | null
  url: string
  is_remote: boolean
  experience_level: string | null
  tags: string[]
}

export interface BraveSearchDiscoveryResult {
  jobs: NormalizedJob[]
  queryCount: number
  rawResultCount: number
  candidateUrlCount: number
  extractedJobCount: number
  skippedExperienceCount: number
}

export async function discoverJobsViaBraveSearch(): Promise<BraveSearchDiscoveryResult> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) {
    console.log('[brave-search] BRAVE_SEARCH_API_KEY not set; skipping search discovery')
    return emptyDiscoveryResult()
  }

  const queryLimit = parsePositiveInt(process.env.BRAVE_SEARCH_QUERY_LIMIT, DEFAULT_QUERY_LIMIT)
  const queries = SEARCH_QUERIES.slice(0, queryLimit)
  const candidateUrls = new Map<string, BraveSearchResult>()
  let rawResultCount = 0

  for (const query of queries) {
    const results = await searchBrave(apiKey, query)
    rawResultCount += results.length
    console.log(`[brave-search] "${query}" returned ${results.length} web results`)

    for (const result of results) {
      const url = normalizeCandidateUrl(result.url)
      if (!url || !isLikelyJobUrl(url, result)) continue
      if (!candidateUrls.has(url)) candidateUrls.set(url, { ...result, url })
    }
  }

  console.log(`[brave-search] ${candidateUrls.size} candidate job URLs after search-result filtering`)

  const jobs: NormalizedJob[] = []
  let extractedJobCount = 0
  let skippedExperienceCount = 0
  for (const [url, result] of candidateUrls) {
    const job = await extractJobFromCandidate(url)
    if (!job) continue
    extractedJobCount++

    const context = [job.title, job.description, result.title, result.description, ...(result.extra_snippets ?? [])].join(' ')
    if (!isLessThanThreeYears(context)) {
      console.log(`[brave-search] Skipped "${job.title}" (${url}) due to experience requirement`)
      skippedExperienceCount++
      continue
    }

    jobs.push({
      ...job,
      experience_level: job.experience_level ?? inferExperienceLevel(context),
      tags: inferTags([job.title, job.description, result.title, result.description].join(' ')),
      posted_at: null,
    })
  }

  console.log(
    `[brave-search] Summary: ${queries.length} queries, ${rawResultCount} raw results, ` +
    `${candidateUrls.size} candidate URLs, ${extractedJobCount} extracted, ` +
    `${skippedExperienceCount} skipped by experience, ${jobs.length} likely entry-level SWE jobs`
  )

  return {
    jobs,
    queryCount: queries.length,
    rawResultCount,
    candidateUrlCount: candidateUrls.size,
    extractedJobCount,
    skippedExperienceCount,
  }
}

function emptyDiscoveryResult(): BraveSearchDiscoveryResult {
  return {
    jobs: [],
    queryCount: 0,
    rawResultCount: 0,
    candidateUrlCount: 0,
    extractedJobCount: 0,
    skippedExperienceCount: 0,
  }
}

async function searchBrave(apiKey: string, query: string): Promise<BraveSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    country: 'US',
    search_lang: 'en',
    ui_lang: 'en-US',
    count: String(RESULTS_PER_QUERY),
    freshness: process.env.BRAVE_SEARCH_FRESHNESS ?? 'pm',
    result_filter: 'web',
    safesearch: 'moderate',
    text_decorations: 'false',
  })

  try {
    const res = await fetch(`${BRAVE_SEARCH_URL}?${params}`, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!res.ok) {
      console.warn(`[brave-search] HTTP ${res.status} for query "${query}"`)
      return []
    }

    const data = await res.json() as BraveSearchResponse
    return data.web?.results ?? []
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(`[brave-search] Query failed: ${reason}`)
    return []
  }
}

function normalizeCandidateUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null
  try {
    const url = new URL(rawUrl)
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === 'ref' || key === 'source') url.searchParams.delete(key)
    }
    return url.toString()
  } catch {
    return null
  }
}

export function isLikelyJobUrl(url: string, result: BraveSearchResult): boolean {
  const parsed = new URL(url)
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  if (JOB_BOARD_HOST_BLOCKLIST.some(blocked => host === blocked || host.endsWith(`.${blocked}`))) return false

  const haystack = [url, result.title, result.description, ...(result.extra_snippets ?? [])].join(' ').toLowerCase()
  const hasJobPath = /\/(jobs?|careers?|positions?|openings?|postings?|job-boards?)\b/.test(parsed.pathname.toLowerCase())
  const hasAtsHost = /greenhouse\.io|lever\.co|ashbyhq\.com|workdayjobs\.com|smartrecruiters\.com|jobvite\.com|recruitee\.com/.test(host)
  const hasJobLanguage = /\b(apply|job|career|software engineer|swe|developer|new grad|junior|associate|entry level|early career)\b/.test(haystack)

  return hasJobLanguage && (hasJobPath || hasAtsHost)
}

async function extractJobFromCandidate(url: string): Promise<ExtractedJob | null> {
  const ats = detectAts(url)
  try {
    if (ats === 'greenhouse') return await fetchFromGreenhouse(url)
    if (ats === 'lever') return await fetchFromLever(url)
    return await fetchFromHtml(url)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(`[brave-search] Failed to extract ${url}: ${reason}`)
    return null
  }
}

function detectAts(url: string): 'greenhouse' | 'lever' | 'other' {
  if (/boards\.greenhouse\.io\/.+\/jobs\/\d+/.test(url)) return 'greenhouse'
  if (/jobs\.lever\.co\/.+\/.+/.test(url)) return 'lever'
  return 'other'
}

async function fetchFromGreenhouse(url: string): Promise<ExtractedJob | null> {
  const match = url.match(/boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/)
  if (!match) return null

  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${match[1]}/jobs/${match[2]}`
  const res = await fetch(apiUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) return null

  const data = await res.json() as {
    title?: string
    location?: { name?: string }
    content?: string
  }
  const description = stripHtml(data.content ?? '').slice(0, 8000)
  const salary = extractSalaryFromText(description)

  return {
    title: data.title ?? 'Untitled',
    company: match[1],
    location: data.location?.name ?? null,
    country: inferCountry(data.location?.name ?? null),
    salary_min: salary.salary_min,
    salary_max: salary.salary_max,
    description,
    url,
    is_remote: isRemoteLocation(data.location?.name ?? null),
    experience_level: inferExperienceLevel([data.title, description].join(' ')),
    tags: inferTags([data.title, description].join(' ')),
  }
}

async function fetchFromLever(url: string): Promise<ExtractedJob | null> {
  const match = url.match(/jobs\.lever\.co\/([^/]+)\/([^/?#]+)/)
  if (!match) return null

  const apiUrl = `https://api.lever.co/v0/postings/${match[1]}/${match[2]}`
  const res = await fetch(apiUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) return null

  const data = await res.json() as {
    text?: string
    categories?: { location?: string; team?: string }
    descriptionPlain?: string
    additionalPlain?: string
    lists?: Array<{ text?: string; content?: string }>
  }

  const description = [
    data.descriptionPlain,
    ...(data.lists ?? []).map((list) => `${list.text ?? ''}\n${stripHtml(list.content ?? '')}`),
    data.additionalPlain,
  ].filter(Boolean).join('\n\n').slice(0, 8000)
  const salary = extractSalaryFromText(description)

  return {
    title: data.text ?? 'Untitled',
    company: match[1],
    location: data.categories?.location ?? null,
    country: inferCountry(data.categories?.location ?? null),
    salary_min: salary.salary_min,
    salary_max: salary.salary_max,
    description,
    url,
    is_remote: isRemoteLocation(data.categories?.location ?? null),
    experience_level: inferExperienceLevel([data.text, description].join(' ')),
    tags: inferTags([data.text, data.categories?.team, description].join(' ')),
  }
}

async function fetchFromHtml(url: string): Promise<ExtractedJob | null> {
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; backlog-brave-search/1.0)',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) return null

  const html = await res.text()
  const jsonLd = extractFromJsonLd(html)
  if (jsonLd) return { ...jsonLd, url }

  return null
}

function extractFromJsonLd(html: string): Omit<ExtractedJob, 'url'> | null {
  const scriptBlocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of scriptBlocks) {
    const parsed = parseJsonLd(match[1])
    const postings = Array.isArray(parsed) ? parsed : [parsed]

    for (const item of postings) {
      if (!isJobPosting(item)) continue

      const rawDescription = typeof item.description === 'string' ? item.description : ''
      const description = stripHtml(rawDescription).replace(/\s+/g, ' ').trim().slice(0, 8000)
      const title = typeof item.title === 'string'
        ? item.title
        : typeof item.name === 'string' ? item.name : 'Untitled'
      const company = extractCompanyName(item.hiringOrganization)
      const location = extractLocation(item.jobLocation)
      const salary = extractSalary(item.baseSalary, description)

      return {
        title,
        company,
        location,
        country: inferCountry(location),
        salary_min: salary.salary_min,
        salary_max: salary.salary_max,
        description,
        is_remote: item.jobLocationType === 'TELECOMMUTE' || isRemoteLocation(location),
        experience_level: inferExperienceLevel([title, description].join(' ')),
        tags: inferTags([title, description].join(' ')),
      }
    }
  }
  return null
}

function parseJsonLd(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isJobPosting(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const type = (value as Record<string, unknown>)['@type']
  if (type === 'JobPosting') return true
  return Array.isArray(type) && type.includes('JobPosting')
}

function extractCompanyName(value: unknown): string {
  if (value && typeof value === 'object') {
    const name = (value as Record<string, unknown>).name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return 'Unknown'
}

function extractLocation(value: unknown): string | null {
  const location = Array.isArray(value) ? value[0] : value
  if (!location || typeof location !== 'object') return null

  const address = (location as Record<string, unknown>).address
  if (!address || typeof address !== 'object') return null

  const addressRecord = address as Record<string, unknown>
  const city = typeof addressRecord.addressLocality === 'string' ? addressRecord.addressLocality : null
  const region = typeof addressRecord.addressRegion === 'string' ? addressRecord.addressRegion : null
  const country = typeof addressRecord.addressCountry === 'string' ? addressRecord.addressCountry : null

  return [city, region, country].filter(Boolean).join(', ') || null
}

function extractSalary(value: unknown, description: string): { salary_min: number | null; salary_max: number | null } {
  if (value && typeof value === 'object') {
    const salary = value as Record<string, unknown>
    const salaryValue = salary.value
    if (salaryValue && typeof salaryValue === 'object') {
      const record = salaryValue as Record<string, unknown>
      const min = typeof record.minValue === 'number' ? record.minValue : null
      const max = typeof record.maxValue === 'number' ? record.maxValue : null
      const single = typeof record.value === 'number' ? record.value : null
      if (min || max || single) return { salary_min: min ?? single, salary_max: max }
    }
  }

  return extractSalaryFromText(description)
}

export function isLessThanThreeYears(text: string): boolean {
  const lower = text.toLowerCase()
  const tooMuchExperience =
    /\b(?:at least|minimum(?: of)?|requires?|must have|you have|you bring|qualifications?)[^.\n]{0,100}\b(?:3|[4-9]|[1-9]\d)\+?\s*(?:years|yrs)\b/.test(lower) ||
    /\b(?:3|[4-9]|[1-9]\d)\+?\s*(?:years|yrs)\s+(?:of\s+)?(?:professional|industry|software|engineering|development|relevant)\s+experience\b/.test(lower)

  return !tooMuchExperience
}

function inferExperienceLevel(text: string): string | null {
  const lower = text.toLowerCase()
  if (/\b(new grad|new graduate|university graduate|junior|associate|entry[-\s]?level|early career|0[-–—\s]?[12]\s+years?|0\s*to\s*2\s+years?)\b/.test(lower)) {
    return 'entry'
  }
  if (/\b(senior|staff|principal|lead|architect)\b/.test(lower)) return 'senior'
  if (/\b(mid[-\s]?level|software engineer ii|engineer ii|level 2)\b/.test(lower)) return 'mid'
  return null
}

function inferTags(text: string): string[] {
  const lower = text.toLowerCase()
  const tags: string[] = []
  if (/typescript|javascript|react|next\.?js|frontend|front[-\s]?end|ui\b/.test(lower)) tags.push('frontend')
  if (/node\.?js|api|backend|back[-\s]?end|server/.test(lower)) tags.push('backend')
  if (/full[-\s]?stack/.test(lower)) tags.push('fullstack')
  if (/\b(ai|artificial intelligence|generative ai|genai|llm)\b/.test(lower)) tags.push('ai')
  if (/python/.test(lower)) tags.push('python')
  if (/java\b/.test(lower)) tags.push('java')
  if (/go\b|golang/.test(lower)) tags.push('go')
  if (/postgres|sql|database/.test(lower)) tags.push('database')
  if (/aws|gcp|azure|cloud/.test(lower)) tags.push('cloud')
  return [...new Set(tags)].slice(0, 5)
}

function inferCountry(location: string | null): string | null {
  if (!location) return 'United States'
  const lower = location.toLowerCase()
  if (/remote|united states|\busa\b|\bus\b/.test(lower)) return 'United States'
  if (/\buk\b|united kingdom|london|england|scotland|wales/.test(lower)) return 'United Kingdom'
  if (/canada|toronto|vancouver|montreal|calgary|ottawa/.test(lower)) return 'Canada'
  if (/germany|berlin|munich|frankfurt|hamburg/.test(lower)) return 'Germany'
  if (/india|bangalore|bengaluru|mumbai|hyderabad|pune|delhi/.test(lower)) return 'India'
  return 'United States'
}

function isRemoteLocation(location: string | null): boolean {
  return Boolean(location && /remote|anywhere/i.test(location))
}

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

  return { salary_min: null, salary_max: null }
}

function parseAmount(raw: string, forceK = false): number {
  const n = parseFloat(raw.replace(/,/g, ''))
  if (isNaN(n)) return 0
  return forceK && n < 1000 ? n * 1000 : n
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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const value = parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}
