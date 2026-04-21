import { supabase } from '../db/client'
import type { NormalizedJob } from '../llm/normalizer'
import { sendJobsNotification } from './discord'
import { sendEmailNotification } from './email'
import { sendPushNotification, type PushSubscription } from './push'

interface UserRow {
  id: string
  email: string | null
  skills: string[] | null
  notification_email: boolean
  notification_push: boolean
  notification_quiet_hours_start: string | null
  notification_quiet_hours_end: string | null
}

interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Dispatches notifications across all configured channels for all users.
 * Deduplicates via notification_log so jobs are never notified twice.
 * Respects each user's quiet hours.
 */
export async function dispatchNotifications(
  newJobs: NormalizedJob[],
  writtenJobPairs: { id: string; url: string }[]
): Promise<void> {
  if (newJobs.length === 0 || writtenJobPairs.length === 0) return

  const writtenJobIds = writtenJobPairs.map((p) => p.id)

  // Build URL → ID map for matching NormalizedJob objects to their DB IDs
  const urlToId = new Map(writtenJobPairs.map((p) => [p.url, p.id]))
  const jobsWithIds = newJobs.flatMap((job) => {
    const id = urlToId.get(job.url)
    return id ? [{ job, id }] : []
  })

  // Fetch users for email/push dispatch + grab skills for Discord relevance sorting
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, skills, notification_email, notification_push, notification_quiet_hours_start, notification_quiet_hours_end')

  if (usersError) console.error('[dispatcher] Failed to fetch users:', usersError)

  // Aggregate all user skills for Discord sorting (personal app, single user set)
  const allSkills = Array.from(
    new Set((users ?? []).flatMap((u: UserRow) => u.skills ?? []))
  )

  // 1. Discord — sorted by relevance, one message with per-job embeds
  await sendJobsNotification(jobsWithIds, newJobs.length, allSkills)

  // 2. Per-user email and push notifications
  const notifyUsers = (users ?? []).filter(
    (u: UserRow) => u.notification_email || u.notification_push
  )
  if (!notifyUsers.length) return

  const nowUtc = new Date()

  for (const user of notifyUsers as UserRow[]) {
    if (isInQuietHours(nowUtc, user.notification_quiet_hours_start, user.notification_quiet_hours_end)) {
      console.log(`[dispatcher] User ${user.id} is in quiet hours — skipping`)
      continue
    }

    const channels: Array<'email' | 'push'> = []
    if (user.notification_email) channels.push('email')
    if (user.notification_push) channels.push('push')

    for (const channel of channels) {
      const unnotifiedJobIds = await getUnnotifiedJobs(user.id, writtenJobIds, channel)
      if (unnotifiedJobIds.length === 0) continue

      const unnotifiedSet = new Set(unnotifiedJobIds)
      const jobsToSend = jobsWithIds
        .filter(({ id }) => unnotifiedSet.has(id))
        .map(({ job }) => job)

      try {
        if (channel === 'email' && user.email) {
          await sendEmailNotification(user.email, jobsToSend, jobsToSend.length)
        } else if (channel === 'push') {
          await sendPushToUser(user.id, jobsToSend)
        }

        await logNotifications(user.id, unnotifiedJobIds, channel)
      } catch (err) {
        console.error(`[dispatcher] Failed to send ${channel} to user ${user.id}:`, err)
      }
    }
  }
}

async function getUnnotifiedJobs(
  userId: string,
  jobIds: string[],
  channel: string
): Promise<string[]> {
  if (jobIds.length === 0) return []

  const { data } = await supabase
    .from('notification_log')
    .select('job_id')
    .eq('user_id', userId)
    .eq('channel', channel)
    .in('job_id', jobIds)

  const alreadyNotified = new Set((data ?? []).map((r: { job_id: string }) => r.job_id))
  return jobIds.filter(id => !alreadyNotified.has(id))
}

async function logNotifications(
  userId: string,
  jobIds: string[],
  channel: string
): Promise<void> {
  if (jobIds.length === 0) return
  const rows = jobIds.map(jobId => ({
    user_id: userId,
    job_id: jobId,
    channel,
    sent_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('notification_log').insert(rows)
  if (error) console.error('[dispatcher] Failed to log notifications:', error)
}

async function sendPushToUser(userId: string, jobs: NormalizedJob[]): Promise<void> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  for (const sub of subs as PushSubscriptionRow[]) {
    try {
      await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth } as PushSubscription,
        jobs,
        jobs.length
      )
    } catch (err) {
      if (err instanceof Error && err.message === 'SUBSCRIPTION_EXPIRED') {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        console.log(`[dispatcher] Removed expired push subscription ${sub.id}`)
      }
    }
  }
}

/**
 * Returns true if the current UTC time falls within the user's quiet hours.
 * Quiet hours are stored as HH:MM:SS strings in UTC.
 */
function isInQuietHours(
  now: Date,
  start: string | null,
  end: string | null
): boolean {
  if (!start || !end) return false

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const startMinutes = toMinutes(start)
  const endMinutes = toMinutes(end)

  // Handle overnight ranges (e.g. 22:00–08:00)
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes
  } else {
    return nowMinutes >= startMinutes || nowMinutes < endMinutes
  }
}
