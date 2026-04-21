import type { NormalizedJob } from '../llm/normalizer'

const MAX_EMBEDS = 10
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

function embedColor(score: number): number {
  if (score > 0.4) return 0x57f287  // Discord green — strong match
  if (score > 0.1) return 0xfee75c  // Discord yellow — moderate match
  return 0x99aab5                   // Discord grey — no signal
}

function formatSalary(min: number | null, max: number | null): string {
  if (min && max) return `$${Math.round(min / 1000)}k – $${Math.round(max / 1000)}k`
  if (min) return `~$${Math.round(min / 1000)}k`
  if (max) return `~$${Math.round(max / 1000)}k`
  return 'Not listed'
}

function daysAgo(postedAt: string | null): string {
  if (!postedAt) return 'Unknown date'
  const days = Math.floor((Date.now() - new Date(postedAt).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
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
  const listed = sorted.slice(0, MAX_EMBEDS)
  const overflow = sorted.length - MAX_EMBEDS

  const embeds = listed.map(({ job, id }) => {
    const deepLink = `${BACKLOG_APP_URL}/feed?job=${id}`
    const location = job.is_remote ? 'Remote' : (job.location ?? 'Location unknown')
    const score = jaccardScore(job.tags ?? [], userSkills)
    const tagChips = (job.tags ?? [])
      .slice(0, 4)
      .map((t) => `\`${t}\``)
      .join(' ')

    return {
      title: job.title,
      url: deepLink,
      description: `**${job.company}** · ${location}`,
      color: embedColor(score),
      fields: [
        { name: 'Salary', value: formatSalary(job.salary_min, job.salary_max), inline: true },
        { name: 'Level', value: job.experience_level ?? 'Not specified', inline: true },
        ...(tagChips ? [{ name: 'Tags', value: tagChips, inline: false }] : []),
      ],
      footer: { text: `Posted ${daysAgo(job.posted_at)}` },
    }
  })

  const payload: Record<string, unknown> = {
    content: `**${written} new job${written === 1 ? '' : 's'}** — [View all on Backlog](${BACKLOG_APP_URL}/feed)`,
    embeds,
  }

  if (overflow > 0) {
    payload.content = `**${written} new job${written === 1 ? '' : 's'}** (+${overflow} more not shown) — [View all on Backlog](${BACKLOG_APP_URL}/feed)`
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
      console.log(`[discord] Notified — ${written} job${written === 1 ? '' : 's'} (${listed.length} embeds)`)
    }
  } catch (err) {
    console.error('[discord] Webhook request threw:', err)
  }
}
