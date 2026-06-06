import type { NormalizedJob } from '../llm/normalizer'

const MAX_LISTED = 10
const BACKLOG_APP_URL = process.env.BACKLOG_APP_URL ?? 'https://backlog.vercel.app'

interface JobWithId {
  job: NormalizedJob
  id: string
}

// Jaccard similarity between job tags and user skills (both lowercased)
function jaccardScore(tags: string[], skills: string[]): number {
  if (tags.length === 0 || skills.length === 0) return 0
  const a = new Set(tags.map((t) => t.toLowerCase()))
  const b = new Set(skills.map((s) => s.toLowerCase()))
  let intersection = 0
  for (const t of a) if (b.has(t)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

// Sort by Jaccard score desc, then salary desc as tiebreaker
export function sortByRelevance(jobsWithIds: JobWithId[], userSkills: string[]): JobWithId[] {
  return [...jobsWithIds].sort((a, b) => {
    const scoreA = jaccardScore(a.job.tags ?? [], userSkills)
    const scoreB = jaccardScore(b.job.tags ?? [], userSkills)
    if (scoreB !== scoreA) return scoreB - scoreA
    const salA = a.job.salary_max ?? a.job.salary_min ?? 0
    const salB = b.job.salary_max ?? b.job.salary_min ?? 0
    return salB - salA
  })
}

function topEmbedColor(jobsWithIds: JobWithId[], userSkills: string[]): number {
  if (jobsWithIds.length === 0 || userSkills.length === 0) return 0x5865f2 // Discord blurple
  const best = Math.max(...jobsWithIds.slice(0, MAX_LISTED).map(({ job }) => jaccardScore(job.tags ?? [], userSkills)))
  if (best > 0.4) return 0x57f287  // green — strong match
  if (best > 0.1) return 0xfee75c  // yellow — moderate match
  return 0x5865f2                  // blurple — no signal
}

function formatSalary(min: number | null, max: number | null): string {
  if (min && max) return `$${Math.round(min / 1000)}k–$${Math.round(max / 1000)}k`
  if (min) return `~$${Math.round(min / 1000)}k`
  if (max) return `~$${Math.round(max / 1000)}k`
  return ''
}

function matchDot(score: number): string {
  if (score > 0.4) return '🟢'
  if (score > 0.1) return '🟡'
  return '⚪'
}

// ─── Source breakdown ring chart ──────────────────────────────────────────────
// Mirrors the labels/icons the dashboard uses for discovery-source badges
// (src/lib/jobs/discovery-source.ts) with hex colors instead of Tailwind
// classes — duplicated rather than imported because the worker is a separate
// package that can't reach into `src/`.

const SOURCE_META: Record<string, { label: string; icon: string; hex: string }> = {
  github_repo:  { label: 'GitHub feed',       icon: '🐙', hex: '#6366f1' },
  brave_search: { label: 'Brave Search',      icon: '🦁', hex: '#f97316' },
  greenhouse:   { label: 'Greenhouse',        icon: '🌱', hex: '#10b981' },
  lever:        { label: 'Lever',             icon: '🎚️', hex: '#06b6d4' },
  workday:      { label: 'Workday',           icon: '📅', hex: '#3b82f6' },
  usajobs:      { label: 'USAJobs',           icon: '🇺🇸', hex: '#f43f5e' },
  manual_url:   { label: 'Pasted URL',        icon: '🔗', hex: '#8b5cf6' },
  manual_entry: { label: 'Added manually',    icon: '✋', hex: '#71717a' },
  extension:    { label: 'Browser extension', icon: '🧩', hex: '#ec4899' },
}
const UNKNOWN_SOURCE_META = { label: 'Other', icon: '🔎', hex: '#52525b' }

export interface SourceCount {
  key: string
  label: string
  icon: string
  hex: string
  count: number
  pct: number
}

export interface SourceRow {
  source: string | null
  source_detail: string | null
}

function resolveSourceKey({ source, source_detail }: SourceRow): string {
  if (source_detail && source_detail in SOURCE_META) return source_detail
  if (source === 'github') return 'github_repo'
  if (source === 'manual') return 'manual_entry'
  return 'unknown'
}

// Counts this batch's jobs by discovery channel, largest slice first. Powers
// both the embed's ring chart and (if QuickChart is unreachable) its fallback text.
export function buildSourceBreakdown(rows: SourceRow[]): SourceCount[] {
  if (rows.length === 0) return []

  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = resolveSourceKey(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const total = rows.length
  return Array.from(counts.entries())
    .map(([key, count]) => {
      const meta = SOURCE_META[key] ?? UNKNOWN_SOURCE_META
      return { key, label: meta.label, icon: meta.icon, hex: meta.hex, count, pct: Math.round((count / total) * 100) }
    })
    .sort((a, b) => b.count - a.count)
}

// Renders the breakdown as a "hollowed out in the middle" ring chart via
// QuickChart.io — a hosted Chart.js renderer, so the worker needs no canvas/
// image deps of its own. Discord embeds the returned URL directly as an image.
// Returns null for <2 slices: a single-color ring conveys nothing.
function sourceChartImageUrl(breakdown: SourceCount[]): string | null {
  if (breakdown.length < 2) return null

  const config = {
    type: 'doughnut',
    data: {
      labels: breakdown.map((s) => `${s.icon}  ${s.label} — ${s.pct}%`),
      datasets: [{
        data: breakdown.map((s) => s.count),
        backgroundColor: breakdown.map((s) => s.hex),
        borderColor: '#18181b',
        borderWidth: 3,
      }],
    },
    options: {
      cutoutPercentage: 68,
      legend: {
        position: 'right',
        labels: { fontColor: '#d4d4d8', fontSize: 12, boxWidth: 14, padding: 10 },
      },
    },
  }

  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&backgroundColor=%2318181b&width=460&height=260&devicePixelRatio=2`
}

export async function sendJobsNotification(
  jobsWithIds: JobWithId[],
  written: number,
  userSkills: string[] = [],
  sourceBreakdown: SourceCount[] = []
): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[discord] DISCORD_WEBHOOK_URL not set — skipping notification')
    return
  }

  if (jobsWithIds.length === 0) return

  const sorted = userSkills.length > 0 ? sortByRelevance(jobsWithIds, userSkills) : jobsWithIds
  const listed = sorted.slice(0, MAX_LISTED)
  const overflow = sorted.length - MAX_LISTED

  // Build a compact linked-list description — one job per line
  // Format: 🟢 [**Title**](link) · Company · Location · Salary · `tag1` `tag2`
  const lines = listed.map(({ job, id }) => {
    const deepLink = `${BACKLOG_APP_URL}/feed?job=${id}`
    const score = jaccardScore(job.tags ?? [], userSkills)
    const dot = userSkills.length > 0 ? matchDot(score) + ' ' : ''
    const location = job.is_remote ? 'Remote' : (job.location ?? '')
    const salary = formatSalary(job.salary_min, job.salary_max)
    const tags = (job.tags ?? []).slice(0, 3).map(t => `\`${t}\``).join(' ')

    const meta = [job.company, location, salary, tags].filter(Boolean).join(' · ')
    return `${dot}[**${job.title}**](${deepLink})\n↳ ${meta}`
  })

  if (overflow > 0) {
    lines.push(`\n*+${overflow} more — [view all on Backlog](${BACKLOG_APP_URL}/feed)*`)
  }

  const description = lines.join('\n\n')

  const embed = {
    color: topEmbedColor(listed, userSkills),
    description,
    footer: {
      text: `${written} new job${written === 1 ? '' : 's'} · Backlog`,
    },
    timestamp: new Date().toISOString(),
  }

  const embeds: Record<string, unknown>[] = [embed]
  const chartUrl = sourceChartImageUrl(sourceBreakdown)
  if (chartUrl) {
    embeds.push({
      color: 0x27272a, // zinc-800 — visually distinct "analytics" card beneath the listing
      title: '📊 Source mix this batch',
      description: sourceBreakdown.map((s) => `${s.icon} **${s.label}** — ${s.count} (${s.pct}%)`).join('\n'),
      image: { url: chartUrl },
    })
  }

  const payload = {
    content: '',
    embeds,
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      console.error(`[discord] Webhook POST failed: ${res.status} ${res.statusText}`)
    } else {
      console.log(`[discord] Notified — ${written} job${written === 1 ? '' : 's'} (${listed.length} listed)`)
    }
  } catch (err) {
    console.error('[discord] Webhook request threw:', err)
  }
}
