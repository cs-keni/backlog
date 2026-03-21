import 'dotenv/config' // only needed locally; Render injects env vars directly
import http from 'http'
import cron from 'node-cron'
import { runAggregation } from './aggregator'
import { sendJobsNotification } from './notifications/discord'

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

async function runAndNotify(): Promise<{ written: number; skipped: boolean }> {
  const result = await runAggregation()
  if (result.written > 0) {
    await sendJobsNotification(result.newJobs, result.written)
  }
  return { written: result.written, skipped: result.skipped }
}

// ── HTTP server ──────────────────────────────────────────────────────────────
// POST /run  — manual trigger from the Next.js app (protected by WORKER_SECRET)
// GET  /health — Render health check

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/run') {
    const secret = req.headers['x-worker-secret']
    if (secret !== WORKER_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    try {
      const result = await runAndNotify()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (err) {
      console.error('[server] /run threw:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Aggregation failed' }))
    }
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
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
