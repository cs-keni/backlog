export const maxDuration = 45

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { isLocationTier, lookupCompBand, type CompBand } from '@/lib/salary/comp-bands'
import type { SupabaseClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function money(value: number): string {
  return `$${value.toLocaleString()}`
}

interface SalaryContext {
  job: { title?: string | null; company?: string | null } | null
  band: CompBand
  comp_target: number | null
  comp_location_tier: string
}

async function loadSalaryContext(
  applicationId: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<{ ok: false; response: Response } | { ok: true; context: SalaryContext }> {
  const [appResult, profileResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, status, jobs(title, company)')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .single(),
    supabase
      .from('users')
      .select('comp_target, comp_location_tier')
      .eq('id', userId)
      .single(),
  ])

  if (!appResult.data) {
    return { ok: false, response: Response.json({ error: 'Application not found' }, { status: 404 }) }
  }
  if (appResult.data.status !== 'offer') {
    return { ok: false, response: Response.json({ error: 'Application is not at offer stage' }, { status: 422 }) }
  }

  const jobs = appResult.data.jobs as
    | { title?: string | null; company?: string | null }
    | { title?: string | null; company?: string | null }[]
    | null
  const job = Array.isArray(jobs) ? (jobs[0] ?? null) : jobs
  const locationTier = isLocationTier(profileResult.data?.comp_location_tier)
    ? profileResult.data.comp_location_tier
    : 'tier1'
  const band = lookupCompBand(job?.title ?? '', locationTier)

  return {
    ok: true,
    context: {
      job,
      band,
      comp_target: profileResult.data?.comp_target ?? null,
      comp_location_tier: locationTier,
    },
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const applicationId = new URL(request.url).searchParams.get('application_id')
  if (!applicationId) return Response.json({ error: 'application_id required' }, { status: 400 })

  const result = await loadSalaryContext(applicationId, user.id, supabase)
  if (!result.ok) return result.response
  return Response.json(result.context)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { application_id?: unknown } | null
  if (!body || typeof body.application_id !== 'string') {
    return Response.json({ error: 'application_id required' }, { status: 400 })
  }

  const result = await loadSalaryContext(body.application_id, user.id, supabase)
  if (!result.ok) return result.response
  const { context } = result

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Write three concise salary negotiation scripts for an offer.
Role: ${context.job?.title ?? 'Role'}
Company: ${context.job?.company ?? 'Company'}
Market range: ${money(context.band.p25)} to ${money(context.band.p75)}, midpoint ${money(context.band.p50)}
Candidate target: ${context.comp_target ? money(context.comp_target) : 'not set'}

Return a JSON object with exactly these three keys, each containing a short ready-to-use script:
{
  "recruiter_call": "...",
  "email_counter": "...",
  "deadline_extension": "..."
}

Return only valid JSON, no markdown fences.`,
    }],
  })

  const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '{}'
  let scripts: { recruiter_call: string; email_counter: string; deadline_extension: string }
  try {
    scripts = JSON.parse(raw)
    if (typeof scripts.recruiter_call !== 'string') throw new Error('bad shape')
  } catch {
    scripts = { recruiter_call: raw, email_counter: '', deadline_extension: '' }
  }

  return Response.json({ ...context, scripts })
}
