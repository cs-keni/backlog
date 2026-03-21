import { fetchLatestCommitSha, fetchReadmeContent } from './github/fetcher'
import { parseJobsTable } from './github/parser'
import { normalizeEntries, type NormalizedJob } from './llm/normalizer'
import { filterNewEntries } from './jobs/deduplicator'
import { writeJobs } from './db/writer'
import { getOrCreateSource, updateSourceSha } from './db/sources'

const SOURCE_NAME = 'SimplifyJobs/New-Grad-Positions'
const SOURCE_URL = 'https://github.com/SimplifyJobs/New-Grad-Positions'

export interface AggregationResult {
  written: number
  newJobs: NormalizedJob[]
  skipped: boolean // true when no new commits were detected
}

export async function runAggregation(): Promise<AggregationResult> {
  const startedAt = Date.now()
  console.log(`\n[aggregator] ─── Run started at ${new Date().toISOString()} ───`)

  try {
    // 1. Ensure the source row exists in the DB
    const source = await getOrCreateSource(SOURCE_NAME, SOURCE_URL)

    // 2. Check for new commits — skip early if nothing changed
    const latestSha = await fetchLatestCommitSha()
    if (source.last_sha === latestSha) {
      console.log(`[aggregator] No new commits (SHA: ${latestSha.slice(0, 7)}). Skipping.`)
      return { written: 0, newJobs: [], skipped: true }
    }
    console.log(
      `[aggregator] New commit detected: ${latestSha.slice(0, 7)} (was: ${source.last_sha?.slice(0, 7) ?? 'none'})`
    )

    // 3. Fetch and parse the full README
    const markdown = await fetchReadmeContent()
    const rawEntries = parseJobsTable(markdown)
    console.log(`[aggregator] Parsed ${rawEntries.length} entries from README`)

    if (rawEntries.length === 0) {
      console.warn('[aggregator] No entries parsed — README format may have changed')
      await updateSourceSha(source.id, latestSha)
      return { written: 0, newJobs: [], skipped: false }
    }

    // 4. Filter out jobs already in the DB (by URL)
    const newEntries = await filterNewEntries(rawEntries)

    if (newEntries.length === 0) {
      console.log('[aggregator] All entries already stored. Updating SHA and exiting.')
      await updateSourceSha(source.id, latestSha)
      return { written: 0, newJobs: [], skipped: false }
    }

    // 5. Normalize via GPT-4o-mini
    console.log(`[aggregator] Normalizing ${newEntries.length} new entries...`)
    const normalizedJobs = await normalizeEntries(newEntries)

    // 6. Write to Supabase
    const written = await writeJobs(normalizedJobs)
    console.log(`[aggregator] Wrote ${written}/${normalizedJobs.length} jobs to DB`)

    // 7. Update source SHA so the next run can skip if unchanged
    await updateSourceSha(source.id, latestSha)

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`[aggregator] ─── Run complete in ${elapsed}s ───\n`)

    return { written, newJobs: normalizedJobs, skipped: false }
  } catch (err) {
    console.error('[aggregator] Run failed:', err)
    // Do NOT update the SHA on failure — we want to retry on the next run
    throw err
  }
}
