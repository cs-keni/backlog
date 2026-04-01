import 'dotenv/config' // only needed locally; Render injects env vars directly
import http from 'http'
import cron from 'node-cron'
import { runAggregation } from './aggregator'
import { dispatchNotifications } from './notifications/dispatcher'

// Validate required env vars at startup rather than at first use
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'WORKER_SECRET',
] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required env var: ${key}`)
    process.exit(1)
  }
}

if (!process.env.GITHUB_TOKEN) {
  console.warn('[startup] GITHUB_TOKEN not set — GitHub API rate limit will be 60 req/hr (unauthenticated)')
}
if (!process.env.DISCORD_WEBHOOK_URL) {
  console.warn('[startup] DISCORD_WEBHOOK_URL not set — Discord notifications disabled')
}

const WORKER_SECRET = process.env.WORKER_SECRET!
const PORT = parseInt(process.env.PORT ?? '3001', 10)

// ── Run lock ─────────────────────────────────────────────────────────────────
// Prevents concurrent aggregation runs (e.g. startup + manual trigger overlap).
let isRunning = false

async function runAndNotify(force = false): Promise<{ written: number; skipped: boolean }> {
  if (isRunning) {
    console.log('[worker] Aggregation already in progress — skipping duplicate run')
    return { written: 0, skipped: true }
  }
  isRunning = true
  try {
    const result = await runAggregation(force)
    if (result.written > 0) {
      await dispatchNotifications(result.newJobs, result.writtenJobIds)
    }
    return { written: result.written, skipped: result.skipped }
  } finally {
    isRunning = false
  }
}

// ── HTTP server ──────────────────────────────────────────────────────────────
// POST /run        — manual trigger (protected by WORKER_SECRET)
// POST /run?force=1 — bypass SHA check, re-process even if README unchanged
// GET  /health     — Render health check

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url?.startsWith('/run')) {
    const secret = req.headers['x-worker-secret']
    if (secret !== WORKER_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    const force = req.url.includes('force=1') || req.url.includes('force=true')

    // Fire-and-forget: respond immediately, aggregation runs in background.
    // The frontend gets notified of new jobs via Supabase realtime inserts.
    if (isRunning) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ written: 0, skipped: true, running: true }))
      return
    }

    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ started: true }))

    runAndNotify(force).catch(console.error)
    return
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: true }))
    return
  }

  res.writeHead(404).end()
})

server.listen(PORT, () => {
  console.log(`[startup] HTTP server listening on port ${PORT}`)
})

// ── Cron ─────────────────────────────────────────────────────────────────────
// Every 8 hours: "0 */8 * * *"

console.log('[startup] Backlog worker starting...')

// Run once immediately on startup so we don't wait for the first cron tick
runAndNotify().catch(console.error)

cron.schedule('0 */8 * * *', () => {
  runAndNotify().catch(console.error)
})

console.log('[startup] Cron scheduled — aggregating every 8 hours')
