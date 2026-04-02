import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [userResult, workResult, eduResult, answersResult, starResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, full_name, phone, address, linkedin_url, github_url, portfolio_url, citizenship_status, visa_sponsorship_required, willing_to_relocate, resume_url, skills, experience_level, years_of_experience, preferred_locations, remote_preference')
      .eq('id', auth.userId)
      .single(),
    supabase
      .from('work_history')
      .select('company, title, start_date, end_date, is_current, description, display_order')
      .eq('user_id', auth.userId)
      .order('display_order'),
    supabase
      .from('education')
      .select('school, degree, field_of_study, gpa, graduation_year, display_order')
      .eq('user_id', auth.userId)
      .order('display_order'),
    supabase
      .from('saved_answers')
      .select('question, answer')
      .eq('user_id', auth.userId),
    supabase
      .from('star_responses')
      .select('question, full_response')
      .eq('user_id', auth.userId)
      .not('full_response', 'is', null),
  ])

  return Response.json({
    user: userResult.data,
    workHistory: workResult.data ?? [],
    education: eduResult.data ?? [],
    savedAnswers: answersResult.data ?? [],
    starResponses: starResult.data ?? [],
  })
}
