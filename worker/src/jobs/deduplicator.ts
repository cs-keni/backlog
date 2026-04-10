import { supabase } from '../db/client'
import type { RawJobEntry } from '../github/parser'
import type { NormalizedJob } from '../llm/normalizer'

const CHUNK_SIZE = 50 // PostgREST URL length limit; keep .in() queries small

// Shared URL-existence check — returns the set of URLs already in the DB.
async function fetchExistingUrls(urls: string[]): Promise<Set<string>> {
  const existingUrls = new Set<string>()
  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE)
    const { data, error } = await supabase.from('jobs').select('url').in('url', chunk)
    if (error) {
      console.error('[deduplicator] Failed to query existing URLs:', error.message)
      // Return empty set — the UNIQUE constraint in the DB is the safety net
      return new Set()
    }
    for (const job of data ?? []) existingUrls.add((job as { url: string }).url)
  }
  return existingUrls
}

// Filters out entries whose URLs already exist in the jobs table.
// Used for raw GitHub entries (before normalization) to avoid burning LLM tokens.
export async function filterNewEntries(entries: RawJobEntry[]): Promise<RawJobEntry[]> {
  if (entries.length === 0) return []

  const urls = entries.map((e) => e.url)
  const existingUrls = await fetchExistingUrls(urls)

  const newEntries = entries.filter((e) => !existingUrls.has(e.url))

  console.log(
    `[deduplicator] ${entries.length} parsed → ${newEntries.length} new (${entries.length - newEntries.length} already stored)`
  )

  return newEntries
}

// Filters already-stored jobs from a NormalizedJob list.
// Used for portal scanning, where jobs arrive pre-structured (no LLM normalization needed).
export async function filterNewJobs(jobs: NormalizedJob[]): Promise<NormalizedJob[]> {
  if (jobs.length === 0) return []

  const urls = jobs.map((j) => j.url)
  const existingUrls = await fetchExistingUrls(urls)

  const newJobs = jobs.filter((j) => !existingUrls.has(j.url))

  console.log(
    `[deduplicator] portals: ${jobs.length} fetched → ${newJobs.length} new (${jobs.length - newJobs.length} already stored)`
  )

  return newJobs
}
