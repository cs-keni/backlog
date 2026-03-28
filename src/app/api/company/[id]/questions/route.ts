export const maxDuration = 30

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateQuestions } from '@/lib/llm/question-generator'

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
    .select('id, name, behavioral_questions, technical_questions')
    .eq('id', id)
    .single()

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 })

  // Return cached questions if they exist
  if (
    (company.behavioral_questions?.length ?? 0) > 0 ||
    (company.technical_questions?.length ?? 0) > 0
  ) {
    return Response.json({
      behavioral_questions: company.behavioral_questions ?? [],
      technical_questions: company.technical_questions ?? [],
    })
  }

  // Generate lazily
  const { data: jobs } = await supabase
    .from('jobs')
    .select('title, description')
    .eq('company_id', id)
    .not('description', 'is', null)
    .order('fetched_at', { ascending: false })
    .limit(5)

  const result = await generateQuestions(company.name, jobs ?? [])

  const admin = createAdminClient()
  await admin
    .from('company_profiles')
    .update({
      behavioral_questions: result.behavioral_questions,
      technical_questions: result.technical_questions,
    })
    .eq('id', id)

  return Response.json(result)
}
