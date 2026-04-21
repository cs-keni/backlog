/**
 * Run manually to check which portal slugs are still valid:
 *   npx ts-node src/portals/validate-slugs.ts
 *
 * Logs OK / 404 / ERROR for every company. Dead slugs return 404 but are
 * handled gracefully at runtime — this script just makes audits easy.
 */

import { PORTAL_COMPANIES } from './companies'

const CONCURRENCY = 5

async function checkSlug(
  name: string,
  type: 'greenhouse' | 'lever',
  slug: string
): Promise<void> {
  const url =
    type === 'greenhouse'
      ? `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`
      : `https://api.lever.co/v0/postings/${slug}?limit=1`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const status = res.status
    if (status === 200) {
      console.log(`  ✓  ${name} (${type}:${slug})`)
    } else if (status === 404) {
      console.warn(`  ✗  ${name} (${type}:${slug}) — 404 NOT FOUND`)
    } else {
      console.warn(`  ?  ${name} (${type}:${slug}) — HTTP ${status}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  !  ${name} (${type}:${slug}) — ERROR: ${msg}`)
  }
}

async function runWithConcurrency(
  tasks: (() => Promise<void>)[],
  concurrency: number
): Promise<void> {
  let index = 0
  async function worker() {
    while (index < tasks.length) {
      const task = tasks[index++]
      await task()
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
}

async function main() {
  console.log(`Validating ${PORTAL_COMPANIES.length} portal companies...\n`)

  const tasks: (() => Promise<void>)[] = []

  for (const company of PORTAL_COMPANIES) {
    if (company.greenhouseSlug) {
      const slug = company.greenhouseSlug
      tasks.push(() => checkSlug(company.name, 'greenhouse', slug))
    }
    if (company.leverSlug) {
      const slug = company.leverSlug
      tasks.push(() => checkSlug(company.name, 'lever', slug))
    }
  }

  await runWithConcurrency(tasks, CONCURRENCY)
  console.log('\nDone.')
}

main().catch(console.error)
