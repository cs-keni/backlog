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

export async function sendJobsNotification(
  jobsWithIds: JobWithId[],
  written: number,
  userSkills: string[] = []
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

  const payload = {
    content: '',
    embeds: [embed],
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
