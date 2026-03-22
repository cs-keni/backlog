import { supabase } from './client'
import type { NormalizedJob } from '../llm/normalizer'

export async function writeJobs(jobs: NormalizedJob[], roleType: 'full_time' | 'internship'): Promise<number> {
  if (jobs.length === 0) return 0

  let written = 0

  for (const job of jobs) {
    const companyId = await getOrCreateCompany(job.company)

    const { error } = await supabase.from('jobs').upsert(
      {
        title: job.title,
        company: job.company,
        company_id: companyId,
        location: job.location,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        description: job.description ?? null,
        url: job.url,
        source: 'github',
        posted_at: job.posted_at,
        is_remote: job.is_remote,
        experience_level: job.experience_level,
        tags: job.tags,
        role_type: roleType,
      },
      { onConflict: 'url', ignoreDuplicates: true }
    )

    if (error) {
      console.error(`[writer] Failed to write job "${job.title}" (${job.url}): ${error.message}`)
    } else {
      written++
    }

    // Backfill salary/description for jobs that already existed in the DB with null values.
    // This runs after every upsert so re-enriched jobs get updated on subsequent runs.
    if (job.salary_min !== null || job.salary_max !== null || job.description) {
      await backfillEnrichedData(job)
    }
  }

  return written
}

// Updates salary and description only where they are currently null in the DB,
// so we never overwrite data that was already present.
async function backfillEnrichedData(job: NormalizedJob): Promise<void> {
  const updates: Record<string, unknown> = {}

  if (job.salary_min !== null) updates.salary_min = job.salary_min
  if (job.salary_max !== null) updates.salary_max = job.salary_max
  if (job.description) updates.description = job.description

  if (Object.keys(updates).length === 0) return

  // Only touch rows where salary is completely absent (both min and max null).
  // Preserves any manually-corrected salary data.
  const { error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('url', job.url)
    .is('salary_min', null)
    .is('salary_max', null)

  if (error) {
    console.error(`[writer] Backfill failed for "${job.url}": ${error.message}`)
  }
}

// Upsert a minimal company_profiles stub — name only.
// Returns the company id, or null on failure (non-fatal; job write will proceed without company_id).
async function getOrCreateCompany(name: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('company_profiles')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('company_profiles')
    .insert({ name })
    .select('id')
    .single()

  if (error || !created) {
    console.error(`[writer] Failed to create company stub for "${name}": ${error?.message}`)
    return null
  }

  return created.id
}
