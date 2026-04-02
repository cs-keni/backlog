import { supabase } from '../db/client'
import { enrichJobs } from './enricher'
import type { NormalizedJob } from '../llm/normalizer'

// Pulls jobs with null salary from the DB, enriches them via URL fetch,
// and writes the results back. Runs at the end of every aggregation cycle
// so already-stored jobs eventually get salary populated.
export async function backfillMissingSalaries(limit = 50): Promise<void> {
  const { data, error } = await supabase
    .from('jobs')
    .select('url, title, company, location, is_remote, experience_level, tags, posted_at')
    .is('salary_min', null)
    .is('salary_max', null)
    .is('description', null)
    .limit(limit)

  if (error) {
    console.error('[backfiller] Failed to query jobs:', error.message)
    return
  }

  if (!data || data.length === 0) {
    console.log('[backfiller] No jobs with missing salary/description — skipping')
    return
  }

  console.log(`[backfiller] Found ${data.length} jobs to enrich`)

  // Shape them into the minimal NormalizedJob needed by enrichJobs
  const stubs: NormalizedJob[] = (data as Array<{
    url: string
    title: string
    company: string
    location: string | null
    is_remote: boolean
    experience_level: string | null
    tags: string[]
    posted_at: string | null
  }>).map((row) => ({
    url: row.url,
    title: row.title,
    company: row.company,
    location: row.location,
    country: null,
    is_remote: row.is_remote,
    salary_min: null,
    salary_max: null,
    experience_level: row.experience_level,
    tags: row.tags ?? [],
    posted_at: row.posted_at,
    description: null,
  }))

  const enriched = await enrichJobs(stubs)

  let updated = 0
  for (const job of enriched) {
    const hasSalary = job.salary_min !== null || job.salary_max !== null
    const hasDescription = Boolean(job.description)
    if (!hasSalary && !hasDescription) continue

    const patch: Record<string, unknown> = {}
    if (job.salary_min !== null) patch.salary_min = job.salary_min
    if (job.salary_max !== null) patch.salary_max = job.salary_max
    if (job.description) patch.description = job.description
    if (job.tags.length > 0) patch.tags = job.tags

    const { error: updateError } = await supabase
      .from('jobs')
      .update(patch)
      .eq('url', job.url)

    if (updateError) {
      console.error(`[backfiller] Update failed for ${job.url}: ${updateError.message}`)
    } else {
      updated++
    }
  }

  console.log(`[backfiller] Updated ${updated}/${data.length} jobs with enriched data`)
}
