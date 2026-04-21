import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sortByRelevance, sendJobsNotification } from '../../src/notifications/discord'
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
})
