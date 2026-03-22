import { fetchLatestCommitSha, fetchReadmeContent } from './github/fetcher'
import { parseJobsTable } from './github/parser'
import { normalizeEntries, type NormalizedJob } from './llm/normalizer'
import { filterNewEntries } from './jobs/deduplicator'
import { enrichJobs } from './jobs/enricher'
import { backfillMissingSalaries } from './jobs/backfiller'
import { writeJobs } from './db/writer'
import { getOrCreateSource, updateSourceSha } from './db/sources'

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
  {
    name: 'SimplifyJobs/Summer2026-Internships',
    url: 'https://github.com/SimplifyJobs/Summer2026-Internships',
    owner: 'SimplifyJobs',
    repo: 'Summer2026-Internships',
    roleType: 'internship',
  },
]

export interface AggregationResult {
  written: number
  newJobs: NormalizedJob[]
  skipped: boolean
}

export async function runAggregation(force = false): Promise<AggregationResult> {
  const startedAt = Date.now()
  console.log(`\n[aggregator] ─── Run started at ${new Date().toISOString()} ───`)

  let totalWritten = 0
  const allNewJobs: NormalizedJob[] = []

  for (const sourceConfig of SOURCES) {
    try {
      const result = await runSourceAggregation(sourceConfig, force)
      totalWritten += result.written
      allNewJobs.push(...result.newJobs)
    } catch (err) {
      console.error(`[aggregator] Failed for source "${sourceConfig.name}":`, err)
      // Continue with next source — one failure shouldn't block the rest
    }
  }

  // Backfill salary + description for already-stored jobs that are missing them.
  // Runs after every cycle so the DB gradually gets enriched over time.
  await backfillMissingSalaries(50)

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`[aggregator] ─── All sources complete in ${elapsed}s (${totalWritten} total written) ───\n`)

  return { written: totalWritten, newJobs: allNewJobs, skipped: false }
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
    return { written: 0, newJobs: [], skipped: true }
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
    return { written: 0, newJobs: [], skipped: false }
  }

  // 4. Filter already-stored jobs
  const newEntries = await filterNewEntries(rawEntries)
  if (newEntries.length === 0) {
    console.log(`[aggregator] ${config.name}: All entries already stored. Updating SHA.`)
    await updateSourceSha(source.id, latestSha)
    return { written: 0, newJobs: [], skipped: false }
  }

  // 5. Normalize via GPT-4o-mini
  console.log(`[aggregator] ${config.name}: Normalizing ${newEntries.length} new entries...`)
  const normalizedJobs = await normalizeEntries(newEntries)

  // 5b. Enrich with salary + description by fetching each job URL
  console.log(`[aggregator] ${config.name}: Enriching ${normalizedJobs.length} jobs...`)
  const enrichedJobs = await enrichJobs(normalizedJobs)

  // 6. Write to Supabase (role_type comes from source config, not LLM)
  const written = await writeJobs(enrichedJobs, config.roleType)
  console.log(`[aggregator] ${config.name}: Wrote ${written}/${enrichedJobs.length} jobs`)

  // 7. Update SHA
  await updateSourceSha(source.id, latestSha)

  return { written, newJobs: enrichedJobs, skipped: false }
}
