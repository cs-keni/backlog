import { PORTAL_COMPANIES } from './companies'
import { fetchGreenhouseJobs } from './greenhouse'
import { fetchLeverJobs } from './lever'
import { fetchWorkdayJobs, WORKDAY_TENANTS } from './workday'
import { fetchUsaJobs } from './usajobs'
import type { NormalizedJob } from '../llm/normalizer'

const CONCURRENCY = 6 // simultaneous company fetches

// Scan all configured portal companies and return their current job listings.
// Companies are fetched in parallel batches. Individual failures are non-fatal.
export async function scanPortals(): Promise<NormalizedJob[]> {
  const allJobs: NormalizedJob[] = []

  // Private-sector ATS portals (Greenhouse + Lever)
  for (let i = 0; i < PORTAL_COMPANIES.length; i += CONCURRENCY) {
    const batch = PORTAL_COMPANIES.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (company) => {
        const jobs: NormalizedJob[] = []
        if (company.greenhouseSlug) {
          const gh = await fetchGreenhouseJobs(company.name, company.greenhouseSlug)
          jobs.push(...gh)
        }
        if (company.leverSlug) {
          const lv = await fetchLeverJobs(company.name, company.leverSlug)
          jobs.push(...lv)
        }
        return jobs
      })
    )
    for (const batch_jobs of results) allJobs.push(...batch_jobs)
  }

  // State/local government jobs via Workday CXS API
  for (let i = 0; i < WORKDAY_TENANTS.length; i += CONCURRENCY) {
    const batch = WORKDAY_TENANTS.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(batch.map(tenant => fetchWorkdayJobs(tenant)))
    for (const result of results) {
      if (result.status === 'fulfilled') allJobs.push(...result.value)
    }
  }

  // Federal government jobs via USAJobs.gov API
  try {
    const federalJobs = await fetchUsaJobs()
    allJobs.push(...federalJobs)
  } catch (err) {
    console.warn('[portals] USAJobs fetch failed:', err)
  }

  console.log(`[portals] Scan complete — ${allJobs.length} total jobs fetched across ${PORTAL_COMPANIES.length} companies + ${WORKDAY_TENANTS.length} Workday tenants + USAJobs`)
  return allJobs
}
