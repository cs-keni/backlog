import { supabase } from './client'
import type { NormalizedJob } from '../llm/normalizer'

export interface WriteResult {
  written: number
  jobIds: string[]
}

export async function writeJobs(jobs: NormalizedJob[], roleType: 'full_time' | 'internship'): Promise<WriteResult> {
  if (jobs.length === 0) return { written: 0, jobIds: [] }

  let written = 0
  const writtenUrls: string[] = []

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
      writtenUrls.push(job.url)
    }
  }

  // Fetch IDs for the written jobs by URL
  let jobIds: string[] = []
  if (writtenUrls.length > 0) {
    const { data } = await supabase
      .from('jobs')
      .select('id')
      .in('url', writtenUrls)
    jobIds = (data ?? []).map((r: { id: string }) => r.id)
  }

  return { written, jobIds }
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
