import { fetchLatestCommitSha, fetchReadmeContent } from './github/fetcher'
import { parseJobsTable } from './github/parser'
import { normalizeEntries, type NormalizedJob } from './llm/normalizer'
import { filterNewEntries, filterNewJobs } from './jobs/deduplicator'
import { filterRelevantEntries, filterRelevantJobs } from './jobs/relevance-filter'
import { enrichJobs } from './jobs/enricher'
import { backfillMissingSalaries } from './jobs/backfiller'
import { writeJobs } from './db/writer'
import { getOrCreateSource, updateSourceSha } from './db/sources'
import { scanPortals } from './portals/index'

interface SourceConfig {
  name: string
  url: string
  owner: string
  repo: string
  roleType: 'full_time' | 'internship'
}

const SOURCES: SourceConfig[] = [
  {
    name: 'SimplifyJobs/New-Grad-Positions',
    url: 'https://github.com/SimplifyJobs/New-Grad-Positions',
    owner: 'SimplifyJobs',
    repo: 'New-Grad-Positions',
    roleType: 'full_time',
  },
]

export interface AggregationResult {
  written: number
  newJobs: NormalizedJob[]
  writtenJobIds: string[]
  writtenJobPairs: { id: string; url: string }[]
  skipped: boolean
}

export async function runAggregation(force = false): Promise<AggregationResult> {
  const startedAt = Date.now()
  console.log(`\n[aggregator] ─── Run started at ${new Date().toISOString()} ───`)

  let totalWritten = 0
  const allNewJobs: NormalizedJob[] = []
  const allWrittenJobIds: string[] = []
  const allWrittenJobPairs: { id: string; url: string }[] = []

  for (const sourceConfig of SOURCES) {
    try {
      const result = await runSourceAggregation(sourceConfig, force)
      totalWritten += result.written
      allNewJobs.push(...result.newJobs)
      allWrittenJobIds.push(...result.writtenJobIds)
      allWrittenJobPairs.push(...result.writtenJobPairs)
    } catch (err) {
      console.error(`[aggregator] Failed for source "${sourceConfig.name}":`, err)
      // Continue with next source — one failure shouldn't block the rest
    }
  }

  // Portal scan: fetch directly from Greenhouse / Lever APIs for curated companies.
  // These APIs return structured JSON so no LLM normalization step is needed.
  try {
    const portalResult = await runPortalAggregation()
    totalWritten += portalResult.written
    allNewJobs.push(...portalResult.newJobs)
    allWrittenJobIds.push(...portalResult.writtenJobIds)
    allWrittenJobPairs.push(...portalResult.writtenJobPairs)
  } catch (err) {
    console.error('[aggregator] Portal scan failed:', err)
  }

  // Backfill salary + description for already-stored jobs that are missing them.
  // Runs after every cycle so the DB gradually gets enriched over time.
  await backfillMissingSalaries(50)

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`[aggregator] ─── All sources complete in ${elapsed}s (${totalWritten} total written) ───\n`)

  return { written: totalWritten, newJobs: allNewJobs, writtenJobIds: allWrittenJobIds, writtenJobPairs: allWrittenJobPairs, skipped: false }
}

async function runPortalAggregation(): Promise<AggregationResult> {
  console.log('\n[aggregator] Running portal scan (Greenhouse + Lever)...')

  const allJobs = await scanPortals()
  if (allJobs.length === 0) {
    console.log('[aggregator] Portals: no jobs fetched')
    return { written: 0, newJobs: [], writtenJobIds: [], writtenJobPairs: [], skipped: false }
  }

  // Drop non-qualifying roles before dedup + enrichment (saves enrichment calls)
  const relevantJobs = filterRelevantJobs(allJobs)

  // Deduplicate against what's already in the DB
  const newJobs = await filterNewJobs(relevantJobs)
  if (newJobs.length === 0) {
    console.log('[aggregator] Portals: all jobs already stored')
    return { written: 0, newJobs: [], writtenJobIds: [], writtenJobPairs: [], skipped: false }
  }

  console.log(`[aggregator] Portals: writing ${newJobs.length} new jobs`)
  // Portal jobs already have descriptions from the API — skip enricher for those that do,
  // but still run it for the ones missing descriptions (Greenhouse requires per-job API calls).
  const jobsToEnrich = newJobs.filter(j => !j.description)
  const jobsWithDesc = newJobs.filter(j => !!j.description)

  let enriched = jobsWithDesc
  if (jobsToEnrich.length > 0) {
    const enrichedMissing = await enrichJobs(jobsToEnrich)
    enriched = [...jobsWithDesc, ...enrichedMissing]
  }

  const { written, jobIds, writtenJobPairs } = await writeJobs(enriched, 'full_time', 'portal')
  console.log(`[aggregator] Portals: wrote ${written}/${enriched.length} jobs`)

  return { written, newJobs: enriched, writtenJobIds: jobIds, writtenJobPairs, skipped: false }
}

async function runSourceAggregation(
  config: SourceConfig,
  force: boolean
): Promise<AggregationResult> {
  console.log(`\n[aggregator] Processing source: ${config.name}`)

  // 1. Ensure source row exists
  const source = await getOrCreateSource(config.name, config.url)

  // 2. Check for new commits
  const latestSha = await fetchLatestCommitSha(config.owner, config.repo)
  if (!force && source.last_sha === latestSha) {
    console.log(`[aggregator] ${config.name}: No new commits (${latestSha.slice(0, 7)}). Skipping.`)
    return { written: 0, newJobs: [], writtenJobIds: [], writtenJobPairs: [], skipped: true }
  }
  if (force) {
    console.log(`[aggregator] ${config.name}: Force mode — bypassing SHA check (${latestSha.slice(0, 7)})`)
  } else {
    console.log(`[aggregator] ${config.name}: New commit detected: ${latestSha.slice(0, 7)} (was: ${source.last_sha?.slice(0, 7) ?? 'none'})`)
  }

  // 3. Fetch and parse README
  const markdown = await fetchReadmeContent(config.owner, config.repo)
  const rawEntries = parseJobsTable(markdown)
  console.log(`[aggregator] ${config.name}: Parsed ${rawEntries.length} entries`)

  if (rawEntries.length === 0) {
    console.warn(`[aggregator] ${config.name}: No entries parsed — README format may have changed. SHA not saved; will retry.`)
    return { written: 0, newJobs: [], writtenJobIds: [], writtenJobPairs: [], skipped: false }
  }

  // 4. Drop non-qualifying roles before dedup + normalization (saves tokens)
  const relevantEntries = filterRelevantEntries(rawEntries)

  // 5. Filter already-stored jobs
  const newEntries = await filterNewEntries(relevantEntries)
  if (newEntries.length === 0) {
    console.log(`[aggregator] ${config.name}: All entries already stored. Updating SHA.`)
    await updateSourceSha(source.id, latestSha)
    return { written: 0, newJobs: [], writtenJobIds: [], writtenJobPairs: [], skipped: false }
  }

  // 6. Normalize via GPT-5 nano
  console.log(`[aggregator] ${config.name}: Normalizing ${newEntries.length} new entries...`)
  const normalizedJobs = await normalizeEntries(newEntries)

  // 7. Enrich with salary + description by fetching each job URL
  console.log(`[aggregator] ${config.name}: Enriching ${normalizedJobs.length} jobs...`)
  const enrichedJobs = await enrichJobs(normalizedJobs)

  // 8. Write to Supabase (role_type comes from source config, not LLM)
  const { written, jobIds, writtenJobPairs } = await writeJobs(enrichedJobs, config.roleType)
  console.log(`[aggregator] ${config.name}: Wrote ${written}/${enrichedJobs.length} jobs`)

  // 9. Update SHA
  await updateSourceSha(source.id, latestSha)

  return { written, newJobs: enrichedJobs, writtenJobIds: jobIds, writtenJobPairs, skipped: false }
}
