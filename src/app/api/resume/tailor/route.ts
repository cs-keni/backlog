export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tailorResume } from '@/lib/llm/resume-tailor'
import { generateResumePDF } from '@/lib/pdf/resume-generator'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { job_id?: string }
  try {
    body = await request.json() as { job_id?: string }
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.job_id) {
    return Response.json({ error: 'job_id is required' }, { status: 400 })
  }

  // ── Fetch all required data in parallel ────────────────────────────────────
  const [profileResult, workResult, eduResult, jobResult, projectsResult] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, email, phone, address, linkedin_url, github_url, skills, resume_text')
      .eq('id', user.id)
      .single(),
    supabase
      .from('work_history')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order'),
    supabase
      .from('education')
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
      { error: 'Upload a text-based resume first before tailoring' },
      { status: 400 }
    )
  }

  // ── Check for existing non-stale version ───────────────────────────────────
  const { data: existing } = await supabase
    .from('resume_versions')
    .select('id, pdf_url, created_at')
    .eq('user_id', user.id)
    .eq('job_id', body.job_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Tailor with Claude ─────────────────────────────────────────────────────
  const tailored = await tailorResume(
    profile.resume_text,
    workResult.data ?? [],
    job.title,
    job.company,
    job.description ?? '',
    profile.skills ?? [],
    projectsResult.data ?? [],
  )

  // ── Generate PDF ───────────────────────────────────────────────────────────
  const pdfBuffer = await generateResumePDF({
    full_name: profile.full_name ?? 'Resume',
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    linkedin_url: profile.linkedin_url,
    github_url: profile.github_url,
    skills: profile.skills ?? [],
    education: eduResult.data ?? [],
    tailored,
  })

  // ── Upload PDF to storage ──────────────────────────────────────────────────
  const adminSupabase = createAdminClient()
  const fileName = `${user.id}/${body.job_id}.pdf`

  const { error: uploadError } = await adminSupabase.storage
    .from('generated-pdfs')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    console.error('[POST /api/resume/tailor] upload error', uploadError)
    return Response.json({ error: 'Failed to save PDF' }, { status: 500 })
  }

  const { data: { publicUrl } } = adminSupabase.storage
    .from('generated-pdfs')
    .getPublicUrl(fileName)

  // ── Upsert resume_versions row ────────────────────────────────────────────
  let versionId: string
  if (existing) {
    const { data: updated } = await supabase
      .from('resume_versions')
      .update({
        content_text: JSON.stringify(tailored),
        pdf_url: publicUrl,
        created_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id')
      .single()
    versionId = updated?.id ?? existing.id
  } else {
    const { data: created } = await supabase
      .from('resume_versions')
      .insert({
        user_id: user.id,
        job_id: body.job_id,
        content_text: JSON.stringify(tailored),
        pdf_url: publicUrl,
      })
      .select('id')
      .single()
    versionId = created?.id ?? ''
  }

  return Response.json({ id: versionId, pdf_url: publicUrl })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id')
  if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 })

  const { data } = await supabase
    .from('resume_versions')
    .select('id, pdf_url, created_at')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Response.json(data ?? null)
}
