import { supabase } from '../db/client'
import type { RawJobEntry } from '../github/parser'

const CHUNK_SIZE = 50 // PostgREST URL length limit; keep .in() queries small

// Filters out entries whose URLs already exist in the jobs table.
// Deduplication is URL-first (jobs.url has a UNIQUE constraint).
// This runs before normalization to avoid burning OpenAI tokens on already-stored jobs.
export async function filterNewEntries(entries: RawJobEntry[]): Promise<RawJobEntry[]> {
  if (entries.length === 0) return []

  const urls = entries.map((e) => e.url)
  const existingUrls = new Set<string>()

  // Chunk the URL list to avoid hitting PostgREST's URL length limit
  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE)
    const { data, error } = await supabase.from('jobs').select('url').in('url', chunk)

    if (error) {
      // If any chunk fails, log and proceed — DB upsert's UNIQUE constraint is the safety net.
      console.error('[deduplicator] Failed to query existing URLs, proceeding without dedup:', error.message)
      return entries
    }

    for (const job of data ?? []) existingUrls.add((job as { url: string }).url)
  }

  const newEntries = entries.filter((e) => !existingUrls.has(e.url))

  console.log(
    `[deduplicator] ${entries.length} parsed → ${newEntries.length} new (${entries.length - newEntries.length} already stored)`
  )

  return newEntries
}
