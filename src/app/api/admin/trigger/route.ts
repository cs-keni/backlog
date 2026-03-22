import { NextResponse } from 'next/server'

// Worker responds immediately (fire-and-forget), so this doesn't need a long timeout
export const maxDuration = 10

export async function POST(request: Request) {
  const workerUrl = process.env.WORKER_URL
  const workerSecret = process.env.WORKER_SECRET

  if (!workerUrl || !workerSecret) {
    return NextResponse.json(
      { error: 'Worker not configured — set WORKER_URL and WORKER_SECRET' },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === '1' || searchParams.get('force') === 'true'

  try {
    const res = await fetch(`${workerUrl}/run${force ? '?force=1' : ''}`, {
      method: 'POST',
      headers: { 'x-worker-secret': workerSecret },
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[trigger] Worker responded ${res.status}: ${body}`)
      return NextResponse.json({ error: 'Worker returned an error' }, { status: 502 })
    }

    // Worker now returns immediately: { started: true } or { skipped: true, running: true }
    const data = (await res.json()) as { started?: boolean; written?: number; skipped?: boolean; running?: boolean }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[trigger] Failed to reach worker:', err)
    return NextResponse.json({ error: 'Could not reach worker' }, { status: 502 })
  }
}
