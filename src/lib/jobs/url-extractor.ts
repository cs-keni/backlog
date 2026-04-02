import OpenAI from 'openai'

export interface ExtractedJob {
  title: string
  company: string
  location: string | null
  country: string | null
  salary_min: number | null
  salary_max: number | null
  description: string
  url: string
  is_remote: boolean
  experience_level: string | null
  tags: string[]
}

// ─── URL pattern detection ────────────────────────────────────────────────────

function detectAts(url: string): 'greenhouse' | 'lever' | 'other' {
  if (/boards\.greenhouse\.io\/.+\/jobs\/\d+/.test(url)) return 'greenhouse'
  if (/jobs\.lever\.co\/.+\/.+/.test(url)) return 'lever'
  return 'other'
}

function extractGreenhouseCompanyAndId(url: string): { company: string; jobId: string } | null {
  const match = url.match(/boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/)
  if (!match) return null
  return { company: match[1], jobId: match[2] }
}

function extractLeverCompanyAndId(url: string): { company: string; jobId: string } | null {
  const match = url.match(/jobs\.lever\.co\/([^/]+)\/([^/?#]+)/)
  if (!match) return null
  return { company: match[1], jobId: match[2] }
}

// ─── ATS API fetchers ─────────────────────────────────────────────────────────

async function fetchFromGreenhouse(url: string): Promise<ExtractedJob | null> {
  const parsed = extractGreenhouseCompanyAndId(url)
  if (!parsed) return null

  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${parsed.company}/jobs/${parsed.jobId}`
  const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null

  const data = await res.json() as {
    title?: string
    location?: { name?: string }
    content?: string
    metadata?: Array<{ name?: string; value?: unknown }>
  }

  const description = stripHtml(data.content ?? '')
  const { salary_min, salary_max } = extractSalaryFromText(description)

  return {
    title: data.title ?? 'Untitled',
    company: parsed.company,
    location: data.location?.name ?? null,
    country: null,
    salary_min,
    salary_max,
    description,
    url,
    is_remote: isRemoteLocation(data.location?.name),
    experience_level: null,
    tags: [],
  }
}

async function fetchFromLever(url: string): Promise<ExtractedJob | null> {
  const parsed = extractLeverCompanyAndId(url)
  if (!parsed) return null

  const apiUrl = `https://api.lever.co/v0/postings/${parsed.company}/${parsed.jobId}`
  const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } })
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
    ...(data.lists ?? []).map((l) => `${l.text ?? ''}\n${l.content ?? ''}`),
    data.additionalPlain,
  ]
    .filter(Boolean)
    .join('\n\n')

  const { salary_min, salary_max } = extractSalaryFromText(description)

  return {
    title: data.text ?? 'Untitled',
    company: parsed.company,
    location: data.categories?.location ?? null,
    country: null,
    salary_min,
    salary_max,
    description,
    url,
    is_remote: isRemoteLocation(data.categories?.location),
    experience_level: null,
    tags: data.categories?.team ? [data.categories.team] : [],
  }
}

// ─── HTML + GPT-4o-mini fallback ─────────────────────────────────────────────

async function fetchFromHtml(url: string): Promise<ExtractedJob | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) return null

  const html = await res.text()

  // Try JSON-LD structured data first (works for some ATS platforms)
  const jsonLdResult = extractFromJsonLd(html)
  if (jsonLdResult) return { ...jsonLdResult, url }

  // Rough text extraction — strip tags, collapse whitespace, cap at 8k chars
  const text = stripHtml(html).replace(/\s+/g, ' ').trim().slice(0, 8000)

  if (text.length < 100) return null // probably JS-rendered, insufficient content

  // Try fast regex salary extraction before spending a GPT call
  const { salary_min, salary_max } = extractSalaryFromText(text)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const openai = new OpenAI({ apiKey })

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a job posting parser. Extract structured data from the job posting text.
Return a JSON object with these exact keys:
  title (string), company (string), location (string|null), salary_min (number|null),
  salary_max (number|null), description (string — the full job description text),
  is_remote (boolean), experience_level ("entry"|"mid"|"senior"|null),
  tags (string[] — skills and technologies mentioned).
If a field cannot be determined, use null or [].`,
      },
      {
        role: 'user',
        content: `URL: ${url}\n\nPage text:\n${text}`,
      },
    ],
  })

  try {
    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}') as Partial<ExtractedJob>
    return {
      title: parsed.title ?? 'Untitled',
      company: parsed.company ?? 'Unknown',
      location: parsed.location ?? null,
      country: null,
      // Prefer regex result if GPT missed it
      salary_min: parsed.salary_min ?? salary_min,
      salary_max: parsed.salary_max ?? salary_max,
      description: parsed.description ?? '',
      url,
      is_remote: parsed.is_remote ?? false,
      experience_level: parsed.experience_level ?? null,
      tags: parsed.tags ?? [],
    }
  } catch {
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extracts salary range from plain text using common patterns:
//   "$73,900 to $110,900"  |  "$80k – $120k"  |  "80000 to 120000"
//   "salary range: $73,900 - $110,900"
export function extractSalaryFromText(text: string): { salary_min: number | null; salary_max: number | null } {
  // Pattern 1: $X[k] [to|–|—|-] $Y[k]  (explicit $ on both sides)
  const dollarRange = text.match(/\$\s*([\d,]+\.?\d*)\s*k?\s*(?:to|–|—|-|\/)\s*\$\s*([\d,]+\.?\d*)\s*k?/i)
  if (dollarRange) {
    const min = parseAmount(dollarRange[1], dollarRange[0].toLowerCase().includes('k'))
    const max = parseAmount(dollarRange[2], dollarRange[0].toLowerCase().includes('k'))
    if (min > 1000 && max > 1000) return { salary_min: min, salary_max: max }
  }

  // Pattern 2: "compensation" / "salary" context with numbers
  const contextRange = text.match(
    /(?:salary|compensation|pay|wage)[^\n$]*\$\s*([\d,]+\.?\d*)\s*k?\s*(?:to|–|—|-)\s*\$?\s*([\d,]+\.?\d*)\s*k?/i
  )
  if (contextRange) {
    const min = parseAmount(contextRange[1], contextRange[0].toLowerCase().includes('k'))
    const max = parseAmount(contextRange[2], contextRange[0].toLowerCase().includes('k'))
    if (min > 10000 && max > 10000) return { salary_min: min, salary_max: max }
  }

  // Pattern 3: lone $ value with "up to" or "+"
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

// Extracts a JobPosting from JSON-LD structured data embedded in the page <head>.
// Returns a partial ExtractedJob (without url — caller fills it in).
function extractFromJsonLd(html: string): Omit<ExtractedJob, 'url'> | null {
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
    const description = stripHtml(rawDesc).replace(/\s+/g, ' ').trim().slice(0, 8000)

    let salary_min: number | null = null
    let salary_max: number | null = null

    // Try schema.org baseSalary
    const baseSalary = data.baseSalary as Record<string, unknown> | undefined
    if (baseSalary) {
      const value = baseSalary.value as Record<string, unknown> | undefined
      if (value) {
        if (typeof value.minValue === 'number') salary_min = value.minValue
        if (typeof value.maxValue === 'number') salary_max = value.maxValue
        if (typeof value.value === 'number') salary_min = value.value
      }
    }

    // If JSON-LD has no salary but we have description, try regex on it
    if (salary_min === null && salary_max === null && description) {
      const extracted = extractSalaryFromText(description)
      salary_min = extracted.salary_min
      salary_max = extracted.salary_max
    }

    const hiringOrg = data.hiringOrganization as Record<string, unknown> | undefined
    const company = typeof hiringOrg?.name === 'string' ? hiringOrg.name : 'Unknown'
    const title = typeof data.title === 'string' ? data.title
      : typeof data.name === 'string' ? data.name : 'Untitled'

    const jobLocation = data.jobLocation as Record<string, unknown> | undefined
    const address = jobLocation?.address as Record<string, unknown> | undefined
    const city = typeof address?.addressLocality === 'string' ? address.addressLocality : null
    const region = typeof address?.addressRegion === 'string' ? address.addressRegion : null
    const location = [city, region].filter(Boolean).join(', ') || null

    const remote = typeof data.jobLocationType === 'string'
      ? data.jobLocationType === 'TELECOMMUTE'
      : isRemoteLocation(location)

    return {
      title,
      company,
      location,
      country: null,
      salary_min,
      salary_max,
      description,
      is_remote: remote,
      experience_level: null,
      tags: [],
    }
  }

  return null
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

function isRemoteLocation(location?: string | null): boolean {
  if (!location) return false
  return /remote/i.test(location)
}

// Infers country from a location string. Returns "United States" as the default
// since most pasted job URLs are US-based; returns a specific country only when
// the location string contains a clear non-US indicator.
function inferCountry(location: string | null): string {
  if (!location) return 'United States'
  const loc = location.toLowerCase()
  if (/\buk\b|united kingdom|england|scotland|wales/.test(loc)) return 'United Kingdom'
  if (/\bcanada\b|toronto|vancouver|montreal|calgary|ottawa|\bon\b|\bbc\b|\bqc\b/.test(loc)) return 'Canada'
  if (/\bgermany\b|berlin|munich|frankfurt|hamburg|stuttgart/.test(loc)) return 'Germany'
  if (/\bfrance\b|\bparis\b.*france|france.*\bparis\b/.test(loc)) return 'France'
  if (/\baustralia\b|sydney|melbourne|brisbane/.test(loc)) return 'Australia'
  if (/\bsingapore\b/.test(loc)) return 'Singapore'
  if (/\bindia\b|bangalore|bengaluru|mumbai|hyderabad|pune/.test(loc)) return 'India'
  if (/\bnetherlands\b|amsterdam/.test(loc)) return 'Netherlands'
  return 'United States'
}

// ─── Main export ──────────────────────────────────────────────────────────────

export type ExtractResult =
  | { ok: true; job: ExtractedJob }
  | { ok: false; jsRendered: boolean; error: string }

export async function extractJobFromUrl(url: string): Promise<ExtractResult> {
  const ats = detectAts(url)

  try {
    let job: ExtractedJob | null = null

    if (ats === 'greenhouse') {
      job = await fetchFromGreenhouse(url)
    } else if (ats === 'lever') {
      job = await fetchFromLever(url)
    } else {
      job = await fetchFromHtml(url)
    }

    if (!job) {
      return {
        ok: false,
        jsRendered: ats === 'other',
        error:
          ats === 'other'
            ? 'Could not extract job from this page. If it requires JavaScript to load, open it in Chrome and use the extension.'
            : 'Could not fetch job from ATS API.',
      }
    }

    return { ok: true, job: { ...job, country: inferCountry(job.location) } }
  } catch (err) {
    const isTimeout =
      err instanceof Error && err.name === 'TimeoutError'
    return {
      ok: false,
      jsRendered: isTimeout,
      error: isTimeout
        ? 'Page took too long to load. Open it in Chrome and use the extension instead.'
        : 'Unexpected error fetching job.',
    }
  }
}
