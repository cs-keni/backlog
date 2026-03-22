import OpenAI from 'openai'

export interface ExtractedJob {
  title: string
  company: string
  location: string | null
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
  return {
    title: data.title ?? 'Untitled',
    company: parsed.company,
    location: data.location?.name ?? null,
    salary_min: null,
    salary_max: null,
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

  return {
    title: data.text ?? 'Untitled',
    company: parsed.company,
    location: data.categories?.location ?? null,
    salary_min: null,
    salary_max: null,
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
  // Rough text extraction — strip tags, collapse whitespace, cap at 8k chars
  const text = stripHtml(html).replace(/\s+/g, ' ').trim().slice(0, 8000)

  if (text.length < 100) return null // probably JS-rendered, insufficient content

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
      salary_min: parsed.salary_min ?? null,
      salary_max: parsed.salary_max ?? null,
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

    return { ok: true, job }
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
