import { describe, it, expect, vi } from 'vitest'
import { makeNormalizedJob } from '../fixtures/jobs'

vi.mock('../../src/db/client', () => ({ supabase: { from: vi.fn() } }))

import {
  PushSubscriptionExpiredError,
  type PushSubscription,
} from '../../src/notifications/push'
import {
  dispatchNotifications,
  isInQuietHours,
  jaccardScore,
  jobMatchesUser,
} from '../../src/notifications/dispatcher'
import type { NormalizedJob } from '../../src/llm/normalizer'

interface UserRow {
  id: string
  email: string | null
  skills: string[] | null
  preferred_locations: string[] | null
  preferred_salary_min: number | null
  remote_preference: 'remote' | 'hybrid' | 'onsite' | 'any' | null
  notification_email: boolean
  notification_push: boolean
  notification_quiet_hours_start: string | null
  notification_quiet_hours_end: string | null
  notification_timezone: string | null
  alert_match_threshold: number | null
}

interface NotificationLogRow {
  id: string
  user_id: string
  job_id: string
  channel: string
  status: string
  sent_at: string | null
  error: string | null
}

interface PushSubRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

const baseUser: UserRow = {
  id: 'user-1',
  email: 'kenny@example.com',
  skills: ['typescript', 'react'],
  preferred_locations: null,
  preferred_salary_min: null,
  remote_preference: 'any',
  notification_email: true,
  notification_push: false,
  notification_quiet_hours_start: null,
  notification_quiet_hours_end: null,
  notification_timezone: 'UTC',
  alert_match_threshold: 50,
}

function makeDb(seed: {
  users?: UserRow[]
  logs?: NotificationLogRow[]
  jobs?: Array<{ id: string } & NormalizedJob>
  pushSubs?: PushSubRow[]
}) {
  const state = {
    users: seed.users ?? [],
    notification_log: seed.logs ?? [],
    jobs: seed.jobs ?? [],
    push_subscriptions: seed.pushSubs ?? [],
  }

  class Query {
    private filters: Array<(row: any) => boolean> = []
    private selected: string | null = null
    private mutation: { type: 'update'; patch: Record<string, unknown> } | { type: 'delete' } | null = null

    constructor(private table: keyof typeof state) {}

    select(columns: string) {
      this.selected = columns
      return this
    }

    eq(column: string, value: unknown) {
      this.filters.push((row) => row[column] === value)
      return this
    }

    in(column: string, values: unknown[]) {
      this.filters.push((row) => values.includes(row[column]))
      return this
    }

    insert(rows: Record<string, unknown> | Array<Record<string, unknown>>) {
      const nextRows = Array.isArray(rows) ? rows : [rows]
      for (const row of nextRows) {
        state[this.table].push({ id: `${this.table}-${state[this.table].length + 1}`, ...row } as never)
      }
      return Promise.resolve({ data: null, error: null })
    }

    update(patch: Record<string, unknown>) {
      this.mutation = { type: 'update', patch }
      return this
    }

    delete() {
      this.mutation = { type: 'delete' }
      return this
    }

    then(resolve: (value: { data: any[] | null; error: null }) => void) {
      if (this.mutation?.type === 'update') {
        for (const row of state[this.table] as any[]) {
          if (this.filters.every((filter) => filter(row))) {
            Object.assign(row, this.mutation.patch)
          }
        }
        return Promise.resolve({ data: null, error: null }).then(resolve)
      }

      if (this.mutation?.type === 'delete') {
        const rows = state[this.table] as any[]
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (this.filters.every((filter) => filter(rows[i]))) rows.splice(i, 1)
        }
        return Promise.resolve({ data: null, error: null }).then(resolve)
      }

      const rows = (state[this.table] as any[]).filter((row) =>
        this.filters.every((filter) => filter(row))
      )
      return Promise.resolve({ data: projectRows(rows, this.selected), error: null }).then(resolve)
    }
  }

  return {
    state,
    db: {
      from(table: string) {
        return new Query(table as keyof typeof state)
      },
    },
  }
}

function projectRows(rows: any[], selected: string | null): any[] {
  if (!selected) return rows
  if (selected.includes('id, title, company')) {
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      country: row.country,
      is_remote: row.is_remote,
      salary_min: row.salary_min,
      salary_max: row.salary_max,
      experience_level: row.experience_level,
      tags: row.tags,
      url: row.url,
      posted_at: row.posted_at,
      description: row.description,
    }))
  }
  return rows
}

describe('isInQuietHours', () => {
  it('returns true when now is within daytime window (10:00-22:00)', () => {
    expect(isInQuietHours(new Date('2026-04-21T14:00:00Z'), '10:00:00', '22:00:00')).toBe(true)
  })

  it('returns false when now is outside daytime window', () => {
    expect(isInQuietHours(new Date('2026-04-21T23:00:00Z'), '10:00:00', '22:00:00')).toBe(false)
  })

  it('handles overnight ranges', () => {
    expect(isInQuietHours(new Date('2026-04-21T23:30:00Z'), '22:00:00', '08:00:00')).toBe(true)
    expect(isInQuietHours(new Date('2026-04-21T03:00:00Z'), '22:00:00', '08:00:00')).toBe(true)
    expect(isInQuietHours(new Date('2026-04-21T10:00:00Z'), '22:00:00', '08:00:00')).toBe(false)
  })

  it('evaluates quiet hours in the user timezone', () => {
    const now = new Date('2026-04-21T17:00:00Z')

    expect(isInQuietHours(now, '23:00:00', '08:00:00', 'Asia/Tokyo')).toBe(true)
    expect(isInQuietHours(now, '23:00:00', '08:00:00', 'America/Los_Angeles')).toBe(false)
  })

  it('returns false when either bound is missing', () => {
    expect(isInQuietHours(new Date('2026-04-21T14:00:00Z'), null, '22:00:00')).toBe(false)
    expect(isInQuietHours(new Date('2026-04-21T14:00:00Z'), '10:00:00', null)).toBe(false)
  })
})

describe('notification matching', () => {
  it('uses Jaccard score for threshold matching', () => {
    expect(jaccardScore(['typescript'], ['typescript', 'react'])).toBe(0.5)
    expect(jaccardScore(['cobol'], ['typescript', 'react'])).toBe(0)
  })

  it('applies threshold and saved feed filters', () => {
    const job = makeNormalizedJob({
      tags: ['typescript'],
      is_remote: false,
      salary_max: 120000,
      location: 'Portland, OR',
    })

    expect(jobMatchesUser({ ...baseUser, alert_match_threshold: 40 }, job)).toBe(true)
    expect(jobMatchesUser({ ...baseUser, alert_match_threshold: 60 }, job)).toBe(false)
    expect(jobMatchesUser({ ...baseUser, remote_preference: 'remote' }, job)).toBe(false)
    expect(jobMatchesUser({ ...baseUser, preferred_salary_min: 150000 }, job)).toBe(false)
    expect(jobMatchesUser({ ...baseUser, preferred_locations: ['Seattle'] }, job)).toBe(false)
  })
})

describe('dispatchNotifications', () => {
  it('records pending rows during quiet hours instead of sending', async () => {
    const job = makeNormalizedJob({ tags: ['typescript'] })
    const { db, state } = makeDb({
      users: [{
        ...baseUser,
        notification_quiet_hours_start: '22:00:00',
        notification_quiet_hours_end: '08:00:00',
      }],
    })
    const sendEmail = vi.fn()

    const result = await dispatchNotifications(
      [job],
      [{ id: 'job-1', url: job.url }],
      {
        db,
        now: new Date('2026-04-21T23:30:00Z'),
        sendDiscord: vi.fn(),
        sendEmail,
      }
    )

    expect(sendEmail).not.toHaveBeenCalled()
    expect(result.pending).toBe(1)
    expect(state.notification_log).toMatchObject([
      { user_id: 'user-1', job_id: 'job-1', channel: 'email', status: 'pending' },
    ])
  })

  it('uses each user timezone before queuing quiet-hour pending rows', async () => {
    const job = makeNormalizedJob({ tags: ['typescript'] })
    const { db, state } = makeDb({
      users: [
        {
          ...baseUser,
          id: 'tokyo-user',
          email: 'tokyo@example.com',
          notification_quiet_hours_start: '23:00:00',
          notification_quiet_hours_end: '08:00:00',
          notification_timezone: 'Asia/Tokyo',
        },
        {
          ...baseUser,
          id: 'la-user',
          email: 'la@example.com',
          notification_quiet_hours_start: '23:00:00',
          notification_quiet_hours_end: '08:00:00',
          notification_timezone: 'America/Los_Angeles',
        },
      ],
    })
    const sendEmail = vi.fn().mockResolvedValue(undefined)

    const result = await dispatchNotifications(
      [job],
      [{ id: 'job-1', url: job.url }],
      {
        db,
        now: new Date('2026-04-21T17:00:00Z'),
        sendDiscord: vi.fn(),
        sendEmail,
      }
    )

    expect(result.pending).toBe(1)
    expect(result.sent).toBe(1)
    expect(sendEmail).toHaveBeenCalledWith('la@example.com', [job], 1)
    expect(state.notification_log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: 'tokyo-user', status: 'pending' }),
        expect.objectContaining({ user_id: 'la-user', status: 'sent' }),
      ])
    )
  })

  it('sends pending rows after quiet hours even when no new jobs were written', async () => {
    const job = makeNormalizedJob({ tags: ['typescript'] })
    const { db, state } = makeDb({
      users: [baseUser],
      jobs: [{ id: 'job-1', ...job }],
      logs: [{
        id: 'log-1',
        user_id: 'user-1',
        job_id: 'job-1',
        channel: 'email',
        status: 'pending',
        sent_at: null,
        error: null,
      }],
    })
    const sendEmail = vi.fn().mockResolvedValue(undefined)

    const result = await dispatchNotifications([], [], {
      db,
      now: new Date('2026-04-21T14:00:00Z'),
      sendDiscord: vi.fn(),
      sendEmail,
    })

    expect(sendEmail).toHaveBeenCalledWith('kenny@example.com', [job], 1)
    expect(result.sent).toBe(1)
    expect(state.notification_log[0]).toMatchObject({ status: 'sent', error: null })
  })

  it("does not let a failed row block retry, but a sent row does", async () => {
    const job = makeNormalizedJob({ tags: ['typescript'] })
    const { db, state } = makeDb({
      users: [baseUser],
      jobs: [{ id: 'job-1', ...job }],
      logs: [{
        id: 'log-1',
        user_id: 'user-1',
        job_id: 'job-1',
        channel: 'email',
        status: 'failed',
        sent_at: null,
        error: 'resend down',
      }],
    })
    const sendEmail = vi.fn().mockResolvedValue(undefined)

    await dispatchNotifications([], [], {
      db,
      sendDiscord: vi.fn(),
      sendEmail,
    })
    await dispatchNotifications([job], [{ id: 'job-1', url: job.url }], {
      db,
      sendDiscord: vi.fn(),
      sendEmail,
    })

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(state.notification_log[0]).toMatchObject({ status: 'sent' })
  })

  it('writes failed rows when email delivery throws', async () => {
    const job = makeNormalizedJob({ tags: ['typescript'] })
    const { db, state } = makeDb({ users: [baseUser] })

    const result = await dispatchNotifications([job], [{ id: 'job-1', url: job.url }], {
      db,
      sendDiscord: vi.fn(),
      sendEmail: vi.fn().mockRejectedValue(new Error('resend down')),
    })

    expect(result.failed).toBe(1)
    expect(state.notification_log).toMatchObject([
      { user_id: 'user-1', job_id: 'job-1', status: 'failed', error: 'resend down' },
    ])
  })

  it('deletes expired push subscriptions and logs expired status', async () => {
    const job = makeNormalizedJob({ tags: ['typescript'] })
    const { db, state } = makeDb({
      users: [{ ...baseUser, notification_email: false, notification_push: true }],
      pushSubs: [{
        id: 'sub-1',
        user_id: 'user-1',
        endpoint: 'https://push.example/sub-1',
        p256dh: 'p256dh',
        auth: 'auth',
      }],
    })
    const sendPush = vi.fn(
      async (_sub: PushSubscription, _jobs: NormalizedJob[], _written: number) => {
        throw new PushSubscriptionExpiredError()
      }
    )

    const result = await dispatchNotifications([job], [{ id: 'job-1', url: job.url }], {
      db,
      sendDiscord: vi.fn(),
      sendPush,
    })

    expect(result.expired).toBe(1)
    expect(result.failed).toBe(1)
    expect(state.push_subscriptions).toHaveLength(0)
    expect(state.notification_log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ job_id: 'job-1', channel: 'push', status: 'expired' }),
        expect.objectContaining({ job_id: 'job-1', channel: 'push', status: 'failed' }),
      ])
    )
  })
})
