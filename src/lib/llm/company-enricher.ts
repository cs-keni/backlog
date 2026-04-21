import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  description: string
  mission: string
  notable_products: string[]
  headcount_range: string
  funding_stage: string
  tech_stack: string[]
  website_url: string
}

interface JobSnippet {
  title: string
  description: string | null
  url?: string | null
}

// ─── Website scraping ──────────────────────────────────────────────────────────

// Job boards — if a job URL's domain matches these, it's not the company's own site
const JOB_BOARD_DOMAINS = [
  'greenhouse.io', 'lever.co', 'workday.com', 'myworkdayjobs.com',
  'icims.com', 'bamboohr.com', 'taleo.net', 'smartrecruiters.com',
  'jobvite.com', 'workable.com', 'ashbyhq.com', 'rippling.com',
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com',
  'simplify.jobs', 'wellfound.com', 'ycombinator.com',
]

function extractCompanyWebsite(jobUrls: (string | null | undefined)[]): string | null {
  for (const url of jobUrls) {
    if (!url) continue
    try {
      const { hostname, protocol } = new URL(url)
      const isBoard = JOB_BOARD_DOMAINS.some(b => hostname === b || hostname.endsWith(`.${b}`))
      if (!isBoard) return `${protocol}//${hostname}`
    } catch { /* ignore malformed URLs */ }
  }
  return null
}

async function fetchWebsiteText(websiteUrl: string): Promise<string> {
  const candidates = [`${websiteUrl}/about`, websiteUrl]
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
      })
      if (!res.ok) continue
      const html = await res.text()
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000)
      if (text.length > 150) return text
    } catch { /* timeout or network error — skip */ }
  }
  return ''
}

// ─── Main enrichment function ──────────────────────────────────────────────────

export async function enrichCompany(
  companyName: string,
  jobs: JobSnippet[],
): Promise<EnrichmentResult> {
  // Try to find and scrape company website
  const jobUrls = jobs.map(j => j.url)
  const websiteUrl = extractCompanyWebsite(jobUrls)
  const websiteText = websiteUrl ? await fetchWebsiteText(websiteUrl) : ''

  const jobsText = jobs
    .slice(0, 5)
    .map((j, i) => `Role ${i + 1}: ${j.title}\n${(j.description ?? '').slice(0, 600)}`)
    .join('\n\n')

  const websiteSection = websiteText
    ? `\nCompany website content:\n${websiteText}`
    : ''

  const prompt = `You are building a company research dossier to help a job candidate prepare for interviews at ${companyName}.

Use all available sources below. Prioritize factual accuracy — if you have reliable knowledge about this company from training data, use it. Do not hallucinate specific products, funding rounds, or headcounts.

${websiteSection}

Job postings:
${jobsText}

Respond with a JSON object only, no markdown:
{
  "description": "2-3 sentence overview of what the company does and who they serve",
  "mission": "Their mission statement or a single sentence capturing what they stand for (quote the real one if you know it)",
  "notable_products": ["Up to 6 specific products, services, or initiatives they are known for"],
  "headcount_range": one of "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+",
  "funding_stage": one of "Bootstrapped" | "Pre-seed" | "Seed" | "Series A" | "Series B" | "Series C+" | "Public" | "Unknown",
  "tech_stack": ["Up to 12 technologies they use or are inferred from job postings"]
}

If a field is genuinely unknowable, use "" for strings, [] for arrays, and "Unknown" for funding_stage.`

  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 600,
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<EnrichmentResult>
    const filterStrings = (arr: unknown, max: number): string[] =>
      Array.isArray(arr) ? arr.filter((t): t is string => typeof t === 'string').slice(0, max) : []

    return {
      description: typeof parsed.description === 'string' ? parsed.description : '',
      mission: typeof parsed.mission === 'string' ? parsed.mission : '',
      notable_products: filterStrings(parsed.notable_products, 6),
      headcount_range: typeof parsed.headcount_range === 'string' ? parsed.headcount_range : '',
      funding_stage: typeof parsed.funding_stage === 'string' ? parsed.funding_stage : 'Unknown',
      tech_stack: filterStrings(parsed.tech_stack, 12),
      website_url: websiteUrl ?? '',
    }
  } catch {
    return {
      description: '', mission: '', notable_products: [],
      headcount_range: '', funding_stage: 'Unknown',
      tech_stack: [], website_url: websiteUrl ?? '',
    }
  }
}
