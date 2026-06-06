import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sortByRelevance, sendJobsNotification, buildSourceBreakdown } from '../../src/notifications/discord'
import { makeNormalizedJob } from '../fixtures/jobs'

const makeJobWithId = (overrides = {}, id?: string) => ({
  job: makeNormalizedJob(overrides),
  id: id ?? 'job-' + Math.random().toString(36).slice(2, 7),
})

describe('sortByRelevance', () => {
  it('puts higher Jaccard score first', () => {
    const a = makeJobWithId({ tags: ['typescript', 'react', 'node'] }, 'a')
    const b = makeJobWithId({ tags: ['cobol', 'fortran'] }, 'b')
    const sorted = sortByRelevance([b, a], ['typescript', 'react'])
    expect(sorted[0].id).toBe('a')
  })

  it('breaks tie by salary desc', () => {
    const a = makeJobWithId({ tags: [], salary_max: 200000, salary_min: null }, 'a')
    const b = makeJobWithId({ tags: [], salary_max: 150000, salary_min: null }, 'b')
    const sorted = sortByRelevance([b, a], [])
    expect(sorted[0].id).toBe('a')
  })

  it('jobs with no matching tags sort last when skills are present', () => {
    const match = makeJobWithId({ tags: ['typescript'] }, 'match')
    const noMatch = makeJobWithId({ tags: ['cobol'] }, 'nomatch')
    const sorted = sortByRelevance([noMatch, match], ['typescript'])
    expect(sorted[0].id).toBe('match')
  })

  it('returns same length as input', () => {
    const jobs = Array.from({ length: 5 }, () => makeJobWithId())
    expect(sortByRelevance(jobs, ['python'])).toHaveLength(5)
  })
})

describe('sendJobsNotification', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 })
    )
  })
  afterEach(() => {
    fetchSpy.mockRestore()
    delete process.env.DISCORD_WEBHOOK_URL
  })

  it('skips silently when DISCORD_WEBHOOK_URL is not set', async () => {
    delete process.env.DISCORD_WEBHOOK_URL
    await expect(sendJobsNotification([makeJobWithId()], 1)).resolves.toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls fetch when DISCORD_WEBHOOK_URL is set', async () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test'
    const jobs = Array.from({ length: 3 }, () => makeJobWithId())
    await sendJobsNotification(jobs, 3)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('top 10 listed — overflow message when more than 10 jobs', async () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test'
    const jobs = Array.from({ length: 15 }, (_, i) => makeJobWithId({}, `job-${i}`))
    await sendJobsNotification(jobs, 15)

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    const description: string = body.embeds[0].description
    // overflow text appended
    expect(description).toContain('+5 more')
  })

  it('embed description contains deep-link with ?job= param', async () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test'
    const jobs = [makeJobWithId({}, 'abc-123')]
    await sendJobsNotification(jobs, 1)

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.embeds[0].description).toContain('?job=abc-123')
  })

  it('omits the source-mix embed when no breakdown is passed', async () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test'
    await sendJobsNotification([makeJobWithId()], 1)

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.embeds).toHaveLength(1)
  })

  it('omits the source-mix embed when only one source is represented', async () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test'
    const breakdown = buildSourceBreakdown([
      { source: 'github', source_detail: 'github_repo' },
      { source: 'github', source_detail: 'github_repo' },
    ])
    await sendJobsNotification([makeJobWithId()], 1, [], breakdown)

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.embeds).toHaveLength(1)
  })

  it('appends a ring-chart embed with a QuickChart image URL when 2+ sources are represented', async () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test'
    const breakdown = buildSourceBreakdown([
      { source: 'github', source_detail: 'github_repo' },
      { source: 'github', source_detail: 'github_repo' },
      { source: 'portal', source_detail: 'greenhouse' },
    ])
    await sendJobsNotification([makeJobWithId()], 1, [], breakdown)

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.embeds).toHaveLength(2)

    const chartEmbed = body.embeds[1]
    expect(chartEmbed.title).toContain('Source mix')
    expect(chartEmbed.image.url).toContain('https://quickchart.io/chart?c=')
    expect(chartEmbed.image.url).toContain('doughnut')
    expect(chartEmbed.description).toContain('GitHub feed')
    expect(chartEmbed.description).toContain('67%')
    expect(chartEmbed.description).toContain('Greenhouse')
    expect(chartEmbed.description).toContain('33%')
  })
})

describe('buildSourceBreakdown', () => {
  it('returns an empty array for no rows', () => {
    expect(buildSourceBreakdown([])).toEqual([])
  })

  it('counts and sorts by volume, largest slice first', () => {
    const breakdown = buildSourceBreakdown([
      { source: 'github', source_detail: 'github_repo' },
      { source: 'github', source_detail: 'github_repo' },
      { source: 'github', source_detail: 'github_repo' },
      { source: 'portal', source_detail: 'lever' },
    ])

    expect(breakdown).toHaveLength(2)
    expect(breakdown[0]).toMatchObject({ key: 'github_repo', label: 'GitHub feed', count: 3, pct: 75 })
    expect(breakdown[1]).toMatchObject({ key: 'lever', label: 'Lever', count: 1, pct: 25 })
  })

  it('falls back from source_detail to coarse source for legacy rows', () => {
    const breakdown = buildSourceBreakdown([
      { source: 'github', source_detail: null },
      { source: 'manual', source_detail: null },
      { source: 'portal', source_detail: null },
    ])

    const byKey = Object.fromEntries(breakdown.map((b) => [b.key, b]))
    expect(byKey.github_repo).toMatchObject({ count: 1 })
    expect(byKey.manual_entry).toMatchObject({ count: 1 })
    expect(byKey.unknown).toMatchObject({ label: 'Other', count: 1 })
  })
})
