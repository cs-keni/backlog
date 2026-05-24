import type { NormalizedJob } from '../llm/normalizer'

const BASE_URL = 'https://data.usajobs.gov/api/search'
const TIMEOUT_MS = 15_000
const RESULTS_PER_PAGE = 25

// IT/CS occupation series codes used by OPM for federal tech roles.
// 2210 = Information Technology Management (the main CS series)
// 1550 = Computer Science
// 0854 = Computer Engineering
const IT_JOB_CATEGORIES = ['2210', '1550', '0854']

interface UsaJobsPosition {
  MatchedObjectId: string
  MatchedObjectDescriptor: {
    PositionTitle: string
    OrganizationName: string
    DepartmentName: string
    PositionLocation: Array<{ LocationName: string; CountryCode: string }>
    PositionRemuneration: Array<{
      MinimumRange: string
      MaximumRange: string
      RateIntervalCode: string // "PA" = per annum, "PH" = per hour, "PM" = per month
    }>
    PositionStartDate: string
    PositionURI: string
    ApplyURI: string[]
    UserArea?: {
      Details?: {
        MajorDuties?: string[]
        Requirements?: string
        Qualifications?: string
        WhoMayApply?: { Name: string }
        LowGrade?: string
        HighGrade?: string
      }
    }
  }
}

interface UsaJobsResponse {
  SearchResult: {
    SearchResultCount: number
    SearchResultCountAll: number
    SearchResultItems: UsaJobsPosition[]
  }
}

// Fetch recent IT/CS job postings from the USAJobs.gov public API.
// Requires USAJOBS_API_KEY and USAJOBS_USER_AGENT (your email) in env.
// Register at: https://developer.usajobs.gov/APIRequest/Index
export async function fetchUsaJobs(): Promise<NormalizedJob[]> {
  const apiKey = process.env.USAJOBS_API_KEY
  const userAgent = process.env.USAJOBS_USER_AGENT

  if (!apiKey || !userAgent) {
    console.warn('[usajobs] Skipping — USAJOBS_API_KEY or USAJOBS_USER_AGENT not set. Register at https://developer.usajobs.gov/APIRequest/Index')
    return []
  }

  const allJobs: NormalizedJob[] = []

  for (const categoryCode of IT_JOB_CATEGORIES) {
    const params = new URLSearchParams({
      JobCategoryCode: categoryCode,
      ResultsPerPage: String(RESULTS_PER_PAGE),
      DatePosted: '14', // jobs posted within the last 14 days
      Fields: 'Min',
    })

    let data: UsaJobsResponse
    try {
      const res = await fetch(`${BASE_URL}?${params}`, {
        headers: {
          'Authorization-Key': apiKey,
          'User-Agent': userAgent,
          'Host': 'data.usajobs.gov',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!res.ok) {
        console.warn(`[usajobs] Category ${categoryCode}: HTTP ${res.status}`)
        continue
      }

      data = await res.json() as UsaJobsResponse
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError'
      console.warn(`[usajobs] Category ${categoryCode}: ${isTimeout ? 'timeout' : String(err)}`)
      continue
    }

    const items = data.SearchResult?.SearchResultItems ?? []
    for (const item of items) {
      const job = normalizeUsaJob(item)
      if (job) allJobs.push(job)
    }

    console.log(`[usajobs] Category ${categoryCode}: fetched ${items.length} jobs`)
  }

  console.log(`[usajobs] Total: ${allJobs.length} jobs across ${IT_JOB_CATEGORIES.length} categories`)
  return allJobs
}

function normalizeUsaJob(item: UsaJobsPosition): NormalizedJob | null {
  const d = item.MatchedObjectDescriptor
  if (!d) return null

  const primaryLocation = d.PositionLocation?.[0]
  const locationName = primaryLocation?.LocationName ?? null
  const isRemote = locationName ? /remote|anywhere|nationwide|virtual/i.test(locationName) : false

  const remuneration = d.PositionRemuneration?.[0]
  const { salary_min, salary_max } = parseFederalSalary(remuneration)

  const applyUrl = d.ApplyURI?.[0] ?? d.PositionURI ?? null
  if (!applyUrl) return null

  const agency = d.OrganizationName ?? d.DepartmentName ?? 'Federal Government'
  const details = d.UserArea?.Details

  // Build a minimal description from available structured fields
  const descParts: string[] = []
  if (details?.MajorDuties?.length) descParts.push(details.MajorDuties.join(' '))
  if (details?.Qualifications) descParts.push(details.Qualifications)
  const description = descParts.join('\n\n').slice(0, 8000) || null

  return {
    title: d.PositionTitle,
    company: agency,
    location: locationName,
    country: 'United States',
    is_remote: isRemote,
    salary_min,
    salary_max,
    experience_level: inferExperienceLevel(d.PositionTitle, details?.LowGrade, details?.HighGrade),
    tags: inferTags(d.PositionTitle),
    url: applyUrl,
    posted_at: d.PositionStartDate ?? null,
    description,
  }
}

// Federal pay is typically annual (PA), but some roles show hourly (PH) or monthly (PM).
// GS grade salaries are always per annum.
function parseFederalSalary(
  remuneration?: UsaJobsPosition['MatchedObjectDescriptor']['PositionRemuneration'][0]
): { salary_min: number | null; salary_max: number | null } {
  if (!remuneration) return { salary_min: null, salary_max: null }

  const min = parseFloat(remuneration.MinimumRange)
  const max = parseFloat(remuneration.MaximumRange)
  if (isNaN(min)) return { salary_min: null, salary_max: null }

  const rate = remuneration.RateIntervalCode
  const annualize = (v: number) => {
    if (rate === 'PH') return Math.round(v * 2080)  // ~2080 work hours/year
    if (rate === 'PM') return Math.round(v * 12)
    return Math.round(v)                             // PA — already annual
  }

  return {
    salary_min: annualize(min),
    salary_max: isNaN(max) ? null : annualize(max),
  }
}

// Federal GS grade → experience level mapping.
// GS-5 to GS-9 = entry, GS-11 to GS-12 = mid, GS-13+ = senior.
function inferExperienceLevel(title: string, lowGrade?: string, highGrade?: string): string | null {
  const grade = parseInt(highGrade ?? lowGrade ?? '0', 10)
  if (grade > 0) {
    if (grade <= 9) return 'entry'
    if (grade <= 12) return 'mid'
    return 'senior'
  }
  // Fall back to title heuristics
  const t = title.toLowerCase()
  if (/entry.?level|junior|trainee/.test(t)) return 'entry'
  if (/senior|principal|lead/.test(t)) return 'senior'
  return null
}

function inferTags(title: string): string[] {
  const tags: string[] = []
  const t = title.toLowerCase()
  if (/frontend|react|web|ui/.test(t)) tags.push('frontend')
  if (/backend|api|server/.test(t)) tags.push('backend')
  if (/cloud|aws|azure|gcp|infrastructure|devops/.test(t)) tags.push('platform')
  if (/security|cyber|appsec/.test(t)) tags.push('security')
  if (/data|analytics|scientist/.test(t)) tags.push('data-science')
  if (/machine learning|ml|ai/.test(t)) tags.push('ml')
  return tags.slice(0, 5)
}
