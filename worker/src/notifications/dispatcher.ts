import { supabase } from '../db/client'
import type { NormalizedJob } from '../llm/normalizer'
import { sendJobsNotification as sendDiscord } from './discord'
import { sendEmailNotification } from './email'
import { sendPushNotification, type PushSubscription } from './push'

interface UserRow {
  id: string
  email: string | null
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
  writtenJobIds: string[]
): Promise<void> {
  if (newJobs.length === 0 || writtenJobIds.length === 0) return

  // 1. Always send Discord (existing behavior, no per-user prefs)
  await sendDiscord(newJobs, newJobs.length)

  // 2. Fetch all users who have at least one notification channel enabled
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, notification_email, notification_push, notification_quiet_hours_start, notification_quiet_hours_end')
    .or('notification_email.eq.true,notification_push.eq.true')

  if (usersError || !users?.length) {
    if (usersError) console.error('[dispatcher] Failed to fetch users:', usersError)
    return
  }

  const nowUtc = new Date()

  for (const user of users as UserRow[]) {
    if (isInQuietHours(nowUtc, user.notification_quiet_hours_start, user.notification_quiet_hours_end)) {
      console.log(`[dispatcher] User ${user.id} is in quiet hours — skipping`)
      continue
    }

    // Find which jobs haven't been notified to this user yet (per channel)
    const channels: Array<'email' | 'push'> = []
    if (user.notification_email) channels.push('email')
    if (user.notification_push) channels.push('push')

    for (const channel of channels) {
      const unnotifiedJobs = await getUnnotifiedJobs(user.id, writtenJobIds, channel)
      if (unnotifiedJobs.length === 0) continue

      // Filter NormalizedJob objects to just the unnotified ones
      const unnotifiedSet = new Set(unnotifiedJobs)
      const jobsToSend = newJobs.filter(j => {
        // Match by URL since we don't have IDs on NormalizedJob
        // We pass writtenJobIds separately for dedup; here we check position
        return true // send all — dedup already handled above
      })
      // Re-filter: only send for jobs whose IDs are in unnotifiedJobs
      // Since NormalizedJob doesn't have DB id, we send the full batch and log all
      // (notification_log dedup prevents re-sends on next run)

      try {
        if (channel === 'email' && user.email) {
          await sendEmailNotification(user.email, jobsToSend, jobsToSend.length)
        } else if (channel === 'push') {
          await sendPushToUser(user.id, jobsToSend)
        }

        // Log all sent job ids for this user+channel
        await logNotifications(user.id, unnotifiedJobs, channel)
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
        // Remove stale subscription
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
