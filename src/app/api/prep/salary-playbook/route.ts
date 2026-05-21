export const maxDuration = 45

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { isLocationTier, lookupCompBand } from '@/lib/salary/comp-bands'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function money(value: number): string {
  return `$${value.toLocaleString()}`
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const applicationId = new URL(request.url).searchParams.get('application_id')
  if (!applicationId) return Response.json({ error: 'application_id required' }, { status: 400 })

  const [appResult, profileResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, status, jobs(title, company)')
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('users')
      .select('comp_target, comp_location_tier')
      .eq('id', user.id)
      .single(),
  ])

  if (!appResult.data) return Response.json({ error: 'Application not found' }, { status: 404 })
  if (appResult.data.status !== 'offer') return Response.json({ error: 'Application is not at offer stage' }, { status: 422 })

  const jobs = appResult.data.jobs as { title?: string | null; company?: string | null } | { title?: string | null; company?: string | null }[] | null
  const job = Array.isArray(jobs) ? jobs[0] : jobs
  const locationTier = isLocationTier(profileResult.data?.comp_location_tier) ? profileResult.data.comp_location_tier : 'tier1'
  const band = lookupCompBand(job?.title ?? '', locationTier)

  return Response.json({
    job,
    band,
    comp_target: profileResult.data?.comp_target ?? null,
    comp_location_tier: locationTier,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { application_id?: unknown } | null
  if (!body || typeof body.application_id !== 'string') {
    return Response.json({ error: 'application_id required' }, { status: 400 })
  }

  const base = await GET(new Request(`http://localhost/api/prep/salary-playbook?application_id=${body.application_id}`))
  if (!base.ok) return base
  const context = await base.json() as {
    job: { title?: string | null; company?: string | null }
    band: { p25: number; p50: number; p75: number }
    comp_target: number | null
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 900,
    messages: [{
      role: 'user',
      content: `Write three concise salary negotiation scripts for an offer.
Role: ${context.job.title ?? 'Role'}
Company: ${context.job.company ?? 'Company'}
Market range: ${money(context.band.p25)} to ${money(context.band.p75)}, midpoint ${money(context.band.p50)}
Candidate target: ${context.comp_target ? money(context.comp_target) : 'not set'}

Return plain text with exactly three labeled scripts: recruiter call, email counter, and deadline extension.`,
    }],
  })

  const scripts = message.content[0]?.type === 'text' ? message.content[0].text : ''
  return Response.json({ ...context, scripts })
}
