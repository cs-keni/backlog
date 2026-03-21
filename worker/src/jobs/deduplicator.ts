import { supabase } from '../db/client'
import type { RawJobEntry } from '../github/parser'

// Filters out entries whose URLs already exist in the jobs table.
// Deduplication is URL-first (jobs.url has a UNIQUE constraint).
// This runs before normalization to avoid burning OpenAI tokens on already-stored jobs.
export async function filterNewEntries(entries: RawJobEntry[]): Promise<RawJobEntry[]> {
  if (entries.length === 0) return []

  const urls = entries.map((e) => e.url)

  const { data: existing, error } = await supabase.from('jobs').select('url').in('url', urls)

  if (error) {
    // If the dedup query fails, log and proceed — worst case we hit the DB upsert's
    // UNIQUE constraint and the duplicate is silently ignored.
    console.error('[deduplicator] Failed to query existing URLs, proceeding without dedup:', error.message)
    return entries
  }

  const existingUrls = new Set((existing ?? []).map((j: { url: string }) => j.url))
  const newEntries = entries.filter((e) => !existingUrls.has(e.url))

  console.log(
    `[deduplicator] ${entries.length} parsed → ${newEntries.length} new (${entries.length - newEntries.length} already stored)`
  )

  return newEntries
}
