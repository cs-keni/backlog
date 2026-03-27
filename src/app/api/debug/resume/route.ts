import { createClient } from '@/lib/supabase/server'

// Debug endpoint — shows resume extraction status for the logged-in user
// GET /api/debug/resume
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Not authenticated', authError }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, full_name, phone, address, resume_url, skills, resume_text')
    .eq('id', user.id)
    .single()

  const { data: workHistory } = await supabase
    .from('work_history')
    .select('id, company, title')
    .eq('user_id', user.id)

  const { data: education } = await supabase
    .from('education')
    .select('id, school, degree')
    .eq('user_id', user.id)

  const { data: savedAnswers } = await supabase
    .from('saved_answers')
    .select('id, question')
    .eq('user_id', user.id)

  const resumeTextLength = profile?.resume_text?.length ?? 0
  const resumeTextPreview = profile?.resume_text?.slice(0, 200) ?? null

  return Response.json({
    user_id: user.id,
    email: user.email,
    profile_error: profileError,
    resume_url: profile?.resume_url ?? null,
    resume_text_length: resumeTextLength,
    resume_text_preview: resumeTextPreview,
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    address: profile?.address ?? null,
    skills_count: (profile?.skills ?? []).length,
    skills: profile?.skills ?? [],
    work_history_count: workHistory?.length ?? 0,
    work_history: workHistory ?? [],
    education_count: education?.length ?? 0,
    education: education ?? [],
    saved_answers_count: savedAnswers?.length ?? 0,
    saved_answers: savedAnswers ?? [],
    env_check: {
      has_openai_key: !!process.env.OPENAI_API_KEY,
      has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  })
}
