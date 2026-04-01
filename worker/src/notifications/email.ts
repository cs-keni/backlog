import { Resend } from 'resend'
import type { NormalizedJob } from '../llm/normalizer'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const MAX_LISTED = 20

export async function sendEmailNotification(
  to: string,
  jobs: NormalizedJob[],
  written: number
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email notification')
    return
  }

  const listed = jobs.slice(0, MAX_LISTED)
  const overflow = jobs.length - MAX_LISTED

  const rows = listed.map((job) => {
    const location = job.is_remote ? 'Remote' : (job.location ?? 'Location unknown')
    const salary = formatSalary(job.salary_min, job.salary_max)
    return `
      <tr style="border-bottom:1px solid #27272a">
        <td style="padding:10px 12px;color:#e4e4e7;font-size:13px;font-weight:500">${escHtml(job.company)}</td>
        <td style="padding:10px 12px;color:#a1a1aa;font-size:13px">${escHtml(job.title)}</td>
        <td style="padding:10px 12px;color:#71717a;font-size:12px">${escHtml(location)}</td>
        <td style="padding:10px 12px;color:#71717a;font-size:12px">${salary ? escHtml(salary) : '—'}</td>
        <td style="padding:10px 12px;font-size:12px">
          <a href="${escHtml(job.url)}" style="color:#818cf8;text-decoration:none">Apply →</a>
        </td>
      </tr>`
  }).join('')

  const overflowRow = overflow > 0
    ? `<tr><td colspan="5" style="padding:10px 12px;color:#52525b;font-size:12px;font-style:italic">…and ${overflow} more. Open Backlog to see all.</td></tr>`
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:680px;margin:0 auto;padding:32px 16px">
    <div style="margin-bottom:24px">
      <span style="font-size:18px;font-weight:600;color:#f4f4f5">Backlog</span>
      <span style="margin-left:8px;font-size:13px;color:#52525b">job alert</span>
    </div>

    <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:20px 24px;margin-bottom:20px">
      <p style="margin:0 0 4px;font-size:22px;font-weight:600;color:#f4f4f5">
        ${written} new job${written === 1 ? '' : 's'} found
      </p>
      <p style="margin:0;font-size:13px;color:#71717a">${new Date().toUTCString()}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;background:#18181b;border:1px solid #27272a;border-radius:10px;overflow:hidden">
      <thead>
        <tr style="background:#09090b">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:.05em">Company</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:.05em">Role</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:.05em">Location</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:.05em">Salary</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:.05em"></th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${overflowRow}
      </tbody>
    </table>

    <p style="margin-top:24px;font-size:12px;color:#3f3f46;text-align:center">
      Backlog — your personal job feed
    </p>
  </div>
</body>
</html>`

  try {
    const { error } = await getResend().emails.send({
      from: 'Backlog <onboarding@resend.dev>',
      to,
      subject: `${written} new job${written === 1 ? '' : 's'} on Backlog`,
      html,
    })

    if (error) {
      console.error('[email] Resend error:', error)
    } else {
      console.log(`[email] Sent to ${to} — ${written} job${written === 1 ? '' : 's'}`)
    }
  } catch (err) {
    console.error('[email] Send threw:', err)
  }
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (min && max) return `$${Math.round(min / 1000)}k–$${Math.round(max / 1000)}k`
  if (min) return `~$${Math.round(min / 1000)}k`
  if (max) return `~$${Math.round(max / 1000)}k`
  return null
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
