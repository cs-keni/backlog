import type { NormalizedJob } from '../llm/normalizer'

const TIMEOUT_MS = 15_000

export interface WorkdayTenant {
  name: string       // display name, e.g. "Oregon State Government"
  tenant: string     // Workday tenant slug, e.g. "oregon"
  datacenter: string // e.g. "wd5"
  careerSite: string // career site slug, e.g. "SOR_External_Career_Site"
}

// State/local government employers on Workday.
// Career site slug is the path segment after /en-US/ in job URLs.
export const WORKDAY_TENANTS: WorkdayTenant[] = [
  {
    name: 'Oregon State Government',
    tenant: 'oregon',
    datacenter: 'wd5',
    careerSite: 'SOR_External_Career_Site',
  },
  {
    name: 'Washington State Government',
    tenant: 'watech',
    datacenter: 'wd5',
    careerSite: 'External',
  },
  {
    name: 'City of Seattle',
    tenant: 'seattle',
    datacenter: 'wd5',
    careerSite: 'seattle',
  },
  {
    name: 'City of Portland',
    tenant: 'portlandoregon',
    datacenter: 'wd5',
    careerSite: 'portlandoregon',
  },
]

interface WorkdayJob {
  title: string
  externalPath: string
  locationsText?: string
  postedOn?: string
  timeType?: string
  bulletFields?: string[]
  jobPostingId?: string
}

interface WorkdayResponse {
  total: number
  jobPostings: WorkdayJob[]
}

// Workday's undocumented CXS (Candidate Experience Services) API.
// Used by their own frontend — returns paginated JSON with no auth required.
export async function fetchWorkdayJobs(tenant: WorkdayTenant): Promise<NormalizedJob[]> {
  const baseUrl = `https://${tenant.tenant}.${tenant.datacenter}.myworkdayjobs.com`
  const endpoint = `${baseUrl}/wday/cxs/${tenant.tenant}/${tenant.careerSite}/jobs`

  const allJobs: WorkdayJob[] = []
  let offset = 0
  const limit = 20

  while (true) {
    let data: WorkdayResponse
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; backlog-bot/1.0)',
          'X-Workday-Client': '2022.24.1',
        },
        body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText: '' }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!res.ok) {
        console.warn(`[workday] ${tenant.name}: HTTP ${res.status} at offset ${offset}`)
        break
      }

      data = await res.json() as WorkdayResponse
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError'
      console.warn(`[workday] ${tenant.name}: ${isTimeout ? 'timeout' : String(err)} at offset ${offset}`)
      break
    }

    const page = data.jobPostings ?? []
    allJobs.push(...page)

    if (allJobs.length >= data.total || page.length < limit) break
    offset += limit
  }

  const normalized = allJobs.map((job): NormalizedJob => {
    const loc = job.locationsText ?? null
    const isRemote = loc ? /remote|anywhere/i.test(loc) : false
    const jobUrl = `${baseUrl}/en-US/${tenant.careerSite}${job.externalPath}`

    // Salary is sometimes surfaced in bulletFields as "$X,XXX - $X,XXX"
    const salaryText = job.bulletFields?.find(f => /\$[\d,]/.test(f)) ?? null
    const { salary_min, salary_max } = parseSalaryText(salaryText)

    return {
      title: job.title,
      company: tenant.name,
      location: loc,
      country: inferCountry(loc),
      is_remote: isRemote,
      salary_min,
      salary_max,
      experience_level: inferExperienceLevel(job.title),
      tags: inferTags(job.title),
      url: jobUrl,
      posted_at: parsePostedOn(job.postedOn),
      description: null,
      discoverySource: 'workday',
    }
  })

  console.log(`[workday] ${tenant.name}: fetched ${normalized.length} jobs`)
  return normalized
}

// Parse Workday's "Posted X Days Ago" / "Posted Today" strings into ISO dates.
function parsePostedOn(postedOn?: string): string | null {
  if (!postedOn) return null
  const now = new Date()
  const lower = postedOn.toLowerCase()
  if (/today/.test(lower)) return now.toISOString()
  const days = lower.match(/(\d+)\s+day/)
  if (days) {
    const d = new Date(now)
    d.setDate(d.getDate() - parseInt(days[1], 10))
    return d.toISOString()
  }
  return null
}

// Parse salary strings like "$6,846 - $10,344" — Workday often shows monthly figures
// for government roles. Multiply by 12 to normalize to annual.
function parseSalaryText(text: string | null): { salary_min: number | null; salary_max: number | null } {
  if (!text) return { salary_min: null, salary_max: null }
  const nums = text.match(/\$?([\d,]+)/g)?.map(n => parseInt(n.replace(/[$,]/g, ''), 10)) ?? []
  if (nums.length === 0) return { salary_min: null, salary_max: null }
  const [a, b] = nums
  // Heuristic: values under 20,000 are likely monthly — annualize them
  const annualize = (v: number) => v < 20_000 ? v * 12 : v
  return {
    salary_min: a ? annualize(a) : null,
    salary_max: b ? annualize(b) : null,
  }
}

function inferCountry(location: string | null): string | null {
  if (!location) return 'United States'
  if (/\b(uk|united kingdom|london)\b/i.test(location)) return 'United Kingdom'
  if (/\b(canada|toronto|vancouver)\b/i.test(location)) return 'Canada'
  return 'United States'
}

function inferExperienceLevel(title: string): string | null {
  const t = title.toLowerCase()
  if (/entry.?level|junior|associate|trainee|i\b/.test(t)) return 'entry'
  if (/senior|staff|principal|lead|sr\./.test(t)) return 'senior'
  if (/\b(ii|2|mid|iii|3)\b/.test(t)) return 'mid'
  return null
}

function inferTags(title: string): string[] {
  const tags: string[] = []
  const t = title.toLowerCase()
  if (/frontend|front.?end|react|ui|web/.test(t)) tags.push('frontend')
  if (/backend|back.?end|api|server/.test(t)) tags.push('backend')
  if (/fullstack|full.?stack/.test(t)) tags.push('fullstack')
  if (/machine learning|ml|ai|deep learning/.test(t)) tags.push('ml')
  if (/data science|analyst/.test(t)) tags.push('data-science')
  if (/data engineer/.test(t)) tags.push('data-engineering')
  if (/platform|infrastructure|devops|sre|cloud/.test(t)) tags.push('platform')
  if (/security|appsec|infosec|cyber/.test(t)) tags.push('security')
  if (/mobile|ios|android/.test(t)) tags.push('mobile')
  return tags.slice(0, 5)
}
