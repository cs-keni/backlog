import { supabase } from '../db/client'
import type { NormalizedJob } from '../llm/normalizer'
import { sendJobsNotification } from './discord'
import { sendEmailNotification } from './email'
import {
  PushSubscriptionExpiredError,
  sendPushNotification,
  type PushSubscription,
} from './push'

type NotificationChannel = 'email' | 'push'
type NotificationStatus = 'pending' | 'sent' | 'failed' | 'expired'

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

interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface NotificationLogRow {
  job_id: string
  status: NotificationStatus
}

interface DbJobRow {
  id: string
  title: string
  company: string
  location: string | null
  country: string | null
  is_remote: boolean | null
  salary_min: number | null
  salary_max: number | null
  experience_level: string | null
  tags: string[] | null
  url: string
  posted_at: string | null
  description: string | null
}

interface JobWithId {
  id: string
  job: NormalizedJob
}

interface SupabaseLike {
  from(table: string): any
}

export interface DispatchDependencies {
  db?: SupabaseLike
  now?: Date
  sendDiscord?: typeof sendJobsNotification
  sendEmail?: typeof sendEmailNotification
  sendPush?: typeof sendPushNotification
}

export interface DispatchResult {
  sent: number
  failed: number
  pending: number
  expired: number
}

const USER_SELECT = [
  'id',
  'email',
  'skills',
  'preferred_locations',
  'preferred_salary_min',
  'remote_preference',
  'notification_email',
  'notification_push',
  'notification_quiet_hours_start',
  'notification_quiet_hours_end',
  'notification_timezone',
  'alert_match_threshold',
].join(', ')

/**
 * Dispatches one digest per channel per user.
 *
 * notification_log.status drives retry behavior:
 * - sent: blocks future sends for the same user/job/channel
 * - pending: quiet-hours backlog, retried when quiet hours end
 * - failed: retryable delivery failure
 * - expired: dead push subscription marker; does not block future sends
 */
export async function dispatchNotifications(
  newJobs: NormalizedJob[],
  writtenJobPairs: { id: string; url: string }[],
  deps: DispatchDependencies = {}
): Promise<DispatchResult> {
  const db = deps.db ?? supabase
  const now = deps.now ?? new Date()
  const sendDiscord = deps.sendDiscord ?? sendJobsNotification
  const sendEmail = deps.sendEmail ?? sendEmailNotification
  const sendPush = deps.sendPush ?? sendPushNotification
  const result: DispatchResult = { sent: 0, failed: 0, pending: 0, expired: 0 }

  const currentJobs = pairJobsWithIds(newJobs, writtenJobPairs)
  const currentJobIds = currentJobs.map(({ id }) => id)

  const { data: users, error: usersError } = await db
    .from('users')
    .select(USER_SELECT)

  if (usersError) {
    console.error('[dispatcher] Failed to fetch users:', usersError)
    if (currentJobs.length > 0) {
      await sendDiscordDigest(currentJobs, newJobs.length, [], sendDiscord)
    }
    return result
  }

  const userRows = (users ?? []) as UserRow[]

  if (currentJobs.length > 0) {
    const allSkills = Array.from(
      new Set(userRows.flatMap((u) => u.skills ?? []))
    )
    await sendDiscordDigest(currentJobs, newJobs.length, allSkills, sendDiscord)
  }

  const notifyUsers = userRows.filter((u) => u.notification_email || u.notification_push)
  if (!notifyUsers.length) return result

  for (const user of notifyUsers) {
    const channels: NotificationChannel[] = []
    if (user.notification_email) channels.push('email')
    if (user.notification_push) channels.push('push')

    for (const channel of channels) {
      const retryRows = await getRetryRows(db, user.id, channel)
      const retryJobIds = unique(retryRows.map((row) => row.job_id))
      const retryJobs = await fetchJobsById(db, retryJobIds)
      const combined = mergeJobs(currentJobs, retryJobs)
        .filter(({ job }) => jobMatchesUser(user, job))

      if (combined.length === 0) continue

      const sentJobIds = await getSentJobIds(
        db,
        user.id,
        combined.map(({ id }) => id),
        channel
      )
      const sentSet = new Set(sentJobIds)
      const candidates = rankJobsForUser(
        combined.filter(({ id }) => !sentSet.has(id)),
        user
      )

      if (candidates.length === 0) continue

      if (isInQuietHours(now, user.notification_quiet_hours_start, user.notification_quiet_hours_end, user.notification_timezone)) {
        const currentCandidateIds = candidates
          .map(({ id }) => id)
          .filter((id) => currentJobIds.includes(id))
        result.pending += await recordPendingNotifications(db, user.id, currentCandidateIds, channel)
        continue
      }

      const retrySet = new Set(retryJobIds)
      const retryCandidateIds = candidates
        .map(({ id }) => id)
        .filter((id) => retrySet.has(id))
      const freshCandidateIds = candidates
        .map(({ id }) => id)
        .filter((id) => !retrySet.has(id))
      const jobsToSend = candidates.map(({ job }) => job)

      try {
        if (channel === 'email') {
          if (!user.email) throw new Error('Email notifications enabled but user has no email')
          await sendEmail(user.email, jobsToSend, jobsToSend.length)
        } else {
          const pushResult = await sendPushToUser(db, user.id, jobsToSend, sendPush)
          result.expired += pushResult.expired
          if (pushResult.expired > 0) {
            await logStatusRows(db, user.id, candidates.map(({ id }) => id), channel, 'expired', 'Push subscription expired')
          }
          if (!pushResult.delivered) {
            throw new Error(pushResult.error ?? 'No push subscription delivered')
          }
        }

        await markRetryRows(db, user.id, retryCandidateIds, channel, 'sent')
        await logStatusRows(db, user.id, freshCandidateIds, channel, 'sent')
        result.sent += candidates.length
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[dispatcher] Failed to send ${channel} to user ${user.id}:`, err)
        await markRetryRows(db, user.id, retryCandidateIds, channel, 'failed', message)
        await logStatusRows(db, user.id, freshCandidateIds, channel, 'failed', message)
        result.failed += candidates.length
      }
    }
  }

  return result
}

async function sendDiscordDigest(
  jobsWithIds: JobWithId[],
  rawNewJobCount: number,
  allSkills: string[],
  sendDiscord: typeof sendJobsNotification
): Promise<void> {
  const discordMinRelevance = parseFloat(process.env.DISCORD_MIN_RELEVANCE ?? '0')
  const discordJobs = discordMinRelevance > 0 && allSkills.length > 0
    ? jobsWithIds.filter(({ job }) => jaccardScore(job.tags ?? [], allSkills) >= discordMinRelevance)
    : jobsWithIds

  await sendDiscord(discordJobs, rawNewJobCount, allSkills)
}

function pairJobsWithIds(
  jobs: NormalizedJob[],
  writtenJobPairs: { id: string; url: string }[]
): JobWithId[] {
  const urlToId = new Map(writtenJobPairs.map((p) => [p.url, p.id]))
  return jobs.flatMap((job) => {
    const id = urlToId.get(job.url)
    return id ? [{ id, job }] : []
  })
}

async function getRetryRows(
  db: SupabaseLike,
  userId: string,
  channel: NotificationChannel
): Promise<NotificationLogRow[]> {
  const { data, error } = await db
    .from('notification_log')
    .select('job_id, status')
    .eq('user_id', userId)
    .eq('channel', channel)
    .in('status', ['pending', 'failed'])

  if (error) {
    console.error('[dispatcher] Failed to fetch retry notifications:', error)
    return []
  }

  return (data ?? []) as NotificationLogRow[]
}

async function getSentJobIds(
  db: SupabaseLike,
  userId: string,
  jobIds: string[],
  channel: NotificationChannel
): Promise<string[]> {
  if (jobIds.length === 0) return []

  const { data, error } = await db
    .from('notification_log')
    .select('job_id')
    .eq('user_id', userId)
    .eq('channel', channel)
    .eq('status', 'sent')
    .in('job_id', jobIds)

  if (error) {
    console.error('[dispatcher] Failed to fetch sent notification log:', error)
    return []
  }

  return (data ?? []).map((r: { job_id: string }) => r.job_id)
}

async function fetchJobsById(db: SupabaseLike, jobIds: string[]): Promise<JobWithId[]> {
  if (jobIds.length === 0) return []

  const { data, error } = await db
    .from('jobs')
    .select('id, title, company, location, country, is_remote, salary_min, salary_max, experience_level, tags, url, posted_at, description')
    .in('id', jobIds)

  if (error) {
    console.error('[dispatcher] Failed to fetch pending notification jobs:', error)
    return []
  }

  return ((data ?? []) as DbJobRow[]).map((row) => ({
    id: row.id,
    job: dbJobToNormalizedJob(row),
  }))
}

function dbJobToNormalizedJob(row: DbJobRow): NormalizedJob {
  return {
    title: row.title,
    company: row.company,
    location: row.location,
    country: row.country,
    is_remote: row.is_remote ?? false,
    salary_min: row.salary_min,
    salary_max: row.salary_max,
    experience_level: row.experience_level,
    tags: row.tags ?? [],
    url: row.url,
    posted_at: row.posted_at,
    description: row.description,
  }
}

function mergeJobs(primary: JobWithId[], secondary: JobWithId[]): JobWithId[] {
  const byId = new Map<string, JobWithId>()
  for (const item of secondary) byId.set(item.id, item)
  for (const item of primary) byId.set(item.id, item)
  return Array.from(byId.values())
}

async function recordPendingNotifications(
  db: SupabaseLike,
  userId: string,
  jobIds: string[],
  channel: NotificationChannel
): Promise<number> {
  if (jobIds.length === 0) return 0

  const { data: existing, error: existingError } = await db
    .from('notification_log')
    .select('job_id')
    .eq('user_id', userId)
    .eq('channel', channel)
    .in('status', ['pending', 'sent'])
    .in('job_id', jobIds)

  if (existingError) {
    console.error('[dispatcher] Failed to check pending notification log:', existingError)
    return 0
  }

  const existingSet = new Set((existing ?? []).map((row: { job_id: string }) => row.job_id))
  const rows = jobIds
    .filter((jobId) => !existingSet.has(jobId))
    .map((jobId) => ({
      user_id: userId,
      job_id: jobId,
      channel,
      status: 'pending',
      sent_at: null,
      error: null,
    }))

  if (rows.length === 0) return 0

  const { error } = await db.from('notification_log').insert(rows)
  if (error) {
    console.error('[dispatcher] Failed to record pending notifications:', error)
    return 0
  }

  console.log(`[dispatcher] Queued ${rows.length} ${channel} notification(s) for user ${userId} after quiet hours`)
  return rows.length
}

async function logStatusRows(
  db: SupabaseLike,
  userId: string,
  jobIds: string[],
  channel: NotificationChannel,
  status: NotificationStatus,
  errorMessage?: string
): Promise<void> {
  const uniqueJobIds = unique(jobIds)
  if (uniqueJobIds.length === 0) return

  const rows = uniqueJobIds.map((jobId) => ({
    user_id: userId,
    job_id: jobId,
    channel,
    status,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    error: errorMessage ?? null,
  }))

  const { error } = await db.from('notification_log').insert(rows)
  if (error) console.error('[dispatcher] Failed to log notification status:', error)
}

async function markRetryRows(
  db: SupabaseLike,
  userId: string,
  jobIds: string[],
  channel: NotificationChannel,
  status: 'sent' | 'failed',
  errorMessage?: string
): Promise<void> {
  const uniqueJobIds = unique(jobIds)
  if (uniqueJobIds.length === 0) return

  const { error } = await db
    .from('notification_log')
    .update({
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      error: errorMessage ?? null,
    })
    .eq('user_id', userId)
    .eq('channel', channel)
    .in('status', ['pending', 'failed'])
    .in('job_id', uniqueJobIds)

  if (error) console.error('[dispatcher] Failed to update retry notification status:', error)
}

async function sendPushToUser(
  db: SupabaseLike,
  userId: string,
  jobs: NormalizedJob[],
  sendPush: typeof sendPushNotification
): Promise<{ delivered: boolean; expired: number; error?: string }> {
  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) {
    console.error('[dispatcher] Failed to fetch push subscriptions:', error)
    return { delivered: false, expired: 0, error: error.message ?? 'Could not fetch push subscriptions' }
  }
  if (!subs?.length) return { delivered: false, expired: 0, error: 'No active push subscriptions' }

  let delivered = false
  let expired = 0
  let lastError: string | undefined

  for (const sub of subs as PushSubscriptionRow[]) {
    try {
      await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth } as PushSubscription,
        jobs,
        jobs.length
      )
      delivered = true
    } catch (err) {
      if (err instanceof PushSubscriptionExpiredError) {
        expired += 1
        await db.from('push_subscriptions').delete().eq('id', sub.id)
        console.log(`[dispatcher] Removed expired push subscription ${sub.id}`)
      } else {
        lastError = err instanceof Error ? err.message : String(err)
      }
    }
  }

  return { delivered, expired, error: lastError }
}

export function jobMatchesUser(user: UserRow, job: NormalizedJob): boolean {
  const threshold = (user.alert_match_threshold ?? 70) / 100
  if (jaccardScore(job.tags ?? [], user.skills ?? []) < threshold) return false

  if (user.remote_preference === 'remote' && !job.is_remote) return false
  if (user.remote_preference === 'onsite' && job.is_remote) return false

  const preferredSalary = user.preferred_salary_min
  if (preferredSalary && job.salary_max !== null && job.salary_max < preferredSalary) {
    return false
  }

  const preferredLocations = user.preferred_locations?.filter(Boolean) ?? []
  if (preferredLocations.length > 0 && !job.is_remote) {
    const haystack = [job.location, job.country].filter(Boolean).join(' ').toLowerCase()
    const hasLocationMatch = preferredLocations.some((location) =>
      haystack.includes(location.toLowerCase())
    )
    if (!hasLocationMatch) return false
  }

  return true
}

export function rankJobsForUser(jobs: JobWithId[], user: UserRow): JobWithId[] {
  return [...jobs].sort((a, b) => {
    const scoreDelta =
      jaccardScore(b.job.tags ?? [], user.skills ?? []) -
      jaccardScore(a.job.tags ?? [], user.skills ?? [])
    if (scoreDelta !== 0) return scoreDelta

    const bSalary = b.job.salary_max ?? b.job.salary_min ?? 0
    const aSalary = a.job.salary_max ?? a.job.salary_min ?? 0
    return bSalary - aSalary
  })
}

export function jaccardScore(jobTags: string[], userSkills: string[]): number {
  if (jobTags.length === 0 || userSkills.length === 0) return 1

  const a = new Set(jobTags.map((tag) => tag.toLowerCase()))
  const b = new Set(userSkills.map((skill) => skill.toLowerCase()))
  let intersection = 0
  for (const tag of a) if (b.has(tag)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 1 : intersection / union
}

/**
 * Returns true if now falls within the user's quiet hours in their local timezone.
 */
export function isInQuietHours(
  now: Date,
  start: string | null,
  end: string | null,
  timezone: string | null = 'UTC'
): boolean {
  if (!start || !end) return false

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  let nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
    nowMinutes = hour * 60 + minute
  } catch {
    nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  }
  const startMinutes = toMinutes(start)
  const endMinutes = toMinutes(end)

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}
