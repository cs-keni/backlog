import { PORTAL_COMPANIES } from './companies'
import { fetchGreenhouseJobs } from './greenhouse'
import { fetchLeverJobs } from './lever'
import type { NormalizedJob } from '../llm/normalizer'

const CONCURRENCY = 6 // simultaneous company fetches

// Scan all configured portal companies and return their current job listings.
// Companies are fetched in parallel batches. Individual failures are non-fatal.
export async function scanPortals(): Promise<NormalizedJob[]> {
  const allJobs: NormalizedJob[] = []

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

  console.log(`[portals] Scan complete — ${allJobs.length} total jobs fetched across ${PORTAL_COMPANIES.length} companies`)
  return allJobs
}
