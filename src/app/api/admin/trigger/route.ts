import { NextResponse } from 'next/server'

// Allow up to 60s — aggregation can take a while when normalizing many jobs
export const maxDuration = 60

export async function POST() {
  const workerUrl = process.env.WORKER_URL
  const workerSecret = process.env.WORKER_SECRET

  if (!workerUrl || !workerSecret) {
    return NextResponse.json(
      { error: 'Worker not configured — set WORKER_URL and WORKER_SECRET' },
      { status: 503 }
    )
  }

  try {
    const res = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: { 'x-worker-secret': workerSecret },
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[trigger] Worker responded ${res.status}: ${body}`)
      return NextResponse.json({ error: 'Worker returned an error' }, { status: 502 })
    }

    const data = (await res.json()) as { written: number; skipped: boolean }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[trigger] Failed to reach worker:', err)
    return NextResponse.json({ error: 'Could not reach worker' }, { status: 502 })
  }
}
