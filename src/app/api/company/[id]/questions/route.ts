export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInterviewGuide } from '@/lib/llm/question-generator'
import type { InterviewGuide } from '@/lib/llm/question-generator'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: company } = await supabase
    .from('company_profiles')
    .select('id, name, interview_guide, behavioral_questions, technical_questions')
    .eq('id', id)
    .single()

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 })

  // Return cached interview guide if present (rich format)
  if (company.interview_guide) {
    return Response.json({ guide: company.interview_guide as InterviewGuide })
  }

  // Fall back to legacy simple arrays for already-cached entries
  if (
    (company.behavioral_questions?.length ?? 0) > 0 ||
    (company.technical_questions?.length ?? 0) > 0
  ) {
    return Response.json({
      guide: null,
      behavioral_questions: company.behavioral_questions ?? [],
      technical_questions: company.technical_questions ?? [],
    })
  }

  // Generate lazily — fetch recent job descriptions for context
  const { data: jobs } = await supabase
    .from('jobs')
    .select('title, description')
    .eq('company_id', id)
    .not('description', 'is', null)
    .order('fetched_at', { ascending: false })
    .limit(5)

  const guide = await generateInterviewGuide(company.name, jobs ?? [])

  // Persist interview_guide and backfill legacy columns for backward compat
  const admin = createAdminClient()
  await admin
    .from('company_profiles')
    .update({
      interview_guide: guide,
      behavioral_questions: guide.behavioral_questions.map(q => q.question),
      technical_questions: guide.technical_questions.map(q => q.question),
    })
    .eq('id', id)

  return Response.json({ guide })
}
