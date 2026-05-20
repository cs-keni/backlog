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

export class PushSubscriptionExpiredError extends Error {
  constructor() {
    super('Push subscription expired')
    this.name = 'PushSubscriptionExpiredError'
  }
}

export async function sendPushNotification(
  subscription: PushSubscription,
  jobs: NormalizedJob[],
  written: number
): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    throw new Error('VAPID keys not set')
  }

  configure()

  const topJob = jobs[0]
  const title = written === 1 && topJob
    ? `New match: ${topJob.company}`
    : `${written} new jobs match your profile`
  const body = written === 1 && topJob
    ? topJob.title
    : `${written} new matches — ${topJob?.company ?? 'Backlog'}`

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
    // 410 Gone / 404 Not Found = subscription expired/unsubscribed.
    if (
      err &&
      typeof err === 'object' &&
      'statusCode' in err &&
      ([404, 410] as number[]).includes((err as { statusCode: number }).statusCode)
    ) {
      throw new PushSubscriptionExpiredError()
    }
    if (err instanceof Error) throw err
    throw new Error(String(err))
  }
}
