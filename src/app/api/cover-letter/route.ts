export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { generateCoverLetter, type CoverLetterTemplate } from '@/lib/llm/cover-letter'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { job_id?: string; template_type?: string }
  try {
    body = await request.json() as { job_id?: string; template_type?: string }
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.job_id) {
    return Response.json({ error: 'job_id is required' }, { status: 400 })
  }

  const validTemplates: CoverLetterTemplate[] = ['formal', 'casual', 'startup']
  const templateOverride = validTemplates.includes(body.template_type as CoverLetterTemplate)
    ? (body.template_type as CoverLetterTemplate)
    : undefined

  // ── Fetch all required data in parallel ────────────────────────────────────
  const [profileResult, workResult, jobResult, projectsResult] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, email, skills, resume_text')
      .eq('id', user.id)
      .single(),
    supabase
      .from('work_history')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order'),
    supabase
      .from('jobs')
      .select('id, title, company, description, tags')
      .eq('id', body.job_id)
      .single(),
    supabase
      .from('projects')
      .select('name, description, role, tech_stack, highlights, start_date, end_date, is_current, display_order')
      .eq('user_id', user.id)
      .order('display_order'),
  ])

  const profile = profileResult.data
  const job = jobResult.data

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })

  if (!profile.resume_text || profile.resume_text.length < 100) {
    return Response.json(
      { error: 'Upload a resume first before generating a cover letter' },
      { status: 400 }
    )
  }

  // ── Ensure application exists (auto-create as "saved") ────────────────────
  const { data: existingApp } = await supabase
    .from('applications')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('job_id', body.job_id)
    .maybeSingle()

  let applicationId: string
  if (existingApp) {
    applicationId = existingApp.id
  } else {
    const { data: newApp, error: appError } = await supabase
      .from('applications')
      .upsert(
        {
          user_id: user.id,
          job_id: body.job_id,
          status: 'saved',
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'user_id,job_id' }
      )
      .select('id')
      .single()

    if (appError || !newApp) {
      console.error('[POST /api/cover-letter] application upsert error', appError)
      return Response.json({ error: 'Failed to create application' }, { status: 500 })
    }
    applicationId = newApp.id
  }

  // ── Check for existing cover letter ───────────────────────────────────────
  const { data: existing } = await supabase
    .from('cover_letters')
    .select('id')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Generate with Claude ───────────────────────────────────────────────────
  const result = await generateCoverLetter(
    profile.resume_text,
    workResult.data ?? [],
    job.title,
    job.company,
    job.description ?? '',
    profile.skills ?? [],
    profile.full_name ?? '',
    templateOverride,
    projectsResult.data ?? [],
  )

  // ── Upsert cover_letters row ───────────────────────────────────────────────
  let coverId: string
  if (existing) {
    const { data: updated } = await supabase
      .from('cover_letters')
      .update({
        template_type: result.template_type,
        content: result.content,
      })
      .eq('id', existing.id)
      .select('id')
      .single()
    coverId = updated?.id ?? existing.id
  } else {
    const { data: created, error: insertError } = await supabase
      .from('cover_letters')
      .insert({
        user_id: user.id,
        application_id: applicationId,
        template_type: result.template_type,
        content: result.content,
      })
      .select('id')
      .single()

    if (insertError || !created) {
      console.error('[POST /api/cover-letter] insert error', insertError)
      return Response.json({ error: 'Failed to save cover letter' }, { status: 500 })
    }
    coverId = created.id
  }

  return Response.json({
    id: coverId,
    template_type: result.template_type,
    content: result.content,
    application_id: applicationId,
  })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id')
  if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 })

  // Find application for this job
  const { data: app } = await supabase
    .from('applications')
    .select('id')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .maybeSingle()

  if (!app) return Response.json(null)

  const { data } = await supabase
    .from('cover_letters')
    .select('id, template_type, content, created_at')
    .eq('application_id', app.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Response.json(data ?? null)
}
