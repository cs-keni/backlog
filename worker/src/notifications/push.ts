import webpush from 'web-push'
import type { NormalizedJob } from '../llm/normalizer'

let _configured = false

function configure() {
  if (_configured) return
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!pub || !priv || !subject) return
  webpush.setVapidDetails(subject, pub, priv)
  _configured = true
}

export interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushNotification(
  subscription: PushSubscription,
  jobs: NormalizedJob[],
  written: number
): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    console.warn('[push] VAPID keys not set — skipping push notification')
    return
  }

  configure()

  const title = `${written} new job${written === 1 ? '' : 's'} on Backlog`
  const firstFew = jobs.slice(0, 3).map(j => j.company).join(', ')
  const body = jobs.length > 3
    ? `${firstFew} + ${jobs.length - 3} more`
    : firstFew

  const payload = JSON.stringify({ title, body, url: '/feed' })

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload
    )
    console.log(`[push] Sent to ${subscription.endpoint.slice(0, 40)}…`)
  } catch (err: unknown) {
    // 410 Gone = subscription expired/unsubscribed — caller should remove it
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
      throw new Error('SUBSCRIPTION_EXPIRED')
    }
    console.error('[push] Send threw:', err)
  }
}
