import type { NormalizedJob } from '../llm/normalizer'

const MAX_LISTED = 25

export async function sendJobsNotification(jobs: NormalizedJob[], written: number): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[discord] DISCORD_WEBHOOK_URL not set — skipping notification')
    return
  }

  const listed = jobs.slice(0, MAX_LISTED)
  const overflow = jobs.length - MAX_LISTED

  const lines = listed.map((job) => {
    const location = job.is_remote ? 'Remote' : (job.location ?? 'Location unknown')
    const salary = formatSalary(job.salary_min, job.salary_max)
    return `**${job.company}** — ${job.title} | ${location}${salary ? ` | ${salary}` : ''}`
  })

  if (overflow > 0) {
    lines.push(`*...and ${overflow} more*`)
  }

  const embed = {
    title: `🆕 ${written} new job${written === 1 ? '' : 's'} found`,
    description: lines.join('\n'),
    color: 0x57f287, // Discord green
    footer: {
      text: `Backlog • ${new Date().toUTCString()}`,
    },
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (!res.ok) {
      console.error(`[discord] Webhook POST failed: ${res.status} ${res.statusText}`)
    } else {
      console.log(`[discord] Notified — ${written} job${written === 1 ? '' : 's'}`)
    }
  } catch (err) {
    console.error('[discord] Webhook request threw:', err)
  }
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (min && max) return `$${Math.round(min / 1000)}k–$${Math.round(max / 1000)}k`
  if (min) return `~$${Math.round(min / 1000)}k`
  if (max) return `~$${Math.round(max / 1000)}k`
  return null
}
