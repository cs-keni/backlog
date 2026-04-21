import { createClient } from '@/lib/supabase/server'
import type { ResumeAnalysis } from '@/lib/llm/resume-analyzer'

interface CommitBody {
  analysis: ResumeAnalysis
  approved: {
    skills: boolean
    work_history: number[]   // indices into analysis.work_history
    education: number[]      // indices into analysis.education
    qa_pairs: number[]       // indices into analysis.qa_pairs
    personal_info: boolean
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: CommitBody
  try {
    body = await request.json() as CommitBody
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { analysis, approved } = body
  if (!analysis || !approved) {
    return Response.json({ error: 'analysis and approved are required' }, { status: 400 })
  }

  const { data: currentProfile } = await supabase
    .from('users')
    .select('full_name, phone, address, linkedin_url, github_url, portfolio_url, skills')
    .eq('id', user.id)
    .single()

  // ── Personal info ──────────────────────────────────────────────────────────
  const personalUpdates: Record<string, unknown> = {}
  const profileFieldsFilled: string[] = []
  let skillsExtracted: string[] = []

  if (approved.personal_info) {
    if (!currentProfile?.full_name && analysis.personal_info.full_name) {
      personalUpdates.full_name = analysis.personal_info.full_name
      profileFieldsFilled.push('full_name')
    }
    if (!currentProfile?.phone && analysis.personal_info.phone) {
      personalUpdates.phone = analysis.personal_info.phone
      profileFieldsFilled.push('phone')
    }
    if (!currentProfile?.address && analysis.personal_info.address) {
      personalUpdates.address = analysis.personal_info.address
      profileFieldsFilled.push('address')
    }
    if (!currentProfile?.linkedin_url && analysis.personal_info.linkedin_url) {
      personalUpdates.linkedin_url = analysis.personal_info.linkedin_url
      profileFieldsFilled.push('linkedin_url')
    }
    if (!currentProfile?.github_url && analysis.personal_info.github_url) {
      personalUpdates.github_url = analysis.personal_info.github_url
      profileFieldsFilled.push('github_url')
    }
    if (!currentProfile?.portfolio_url && analysis.personal_info.portfolio_url) {
      personalUpdates.portfolio_url = analysis.personal_info.portfolio_url
      profileFieldsFilled.push('portfolio_url')
    }
  }

  // ── Skills ─────────────────────────────────────────────────────────────────
  if (approved.skills && analysis.skills.length > 0) {
    const existing: string[] = currentProfile?.skills ?? []
    const existingLower = new Set(existing.map(s => s.toLowerCase()))
    const newSkills = analysis.skills.filter(s => !existingLower.has(s.toLowerCase()))
    personalUpdates.skills = [...existing, ...newSkills]
    skillsExtracted = newSkills
  }

  if (Object.keys(personalUpdates).length > 0) {
    await supabase.from('users').update(personalUpdates).eq('id', user.id)
  }

  // ── Work history ───────────────────────────────────────────────────────────
  let workHistoryAdded = 0
  const approvedWork = approved.work_history
    .map(i => analysis.work_history[i])
    .filter(Boolean)

  if (approvedWork.length > 0) {
    const { data: existingWork } = await supabase
      .from('work_history').select('company, title').eq('user_id', user.id)
    const existingKeys = new Set(
      (existingWork ?? []).map(e => `${e.company.toLowerCase()}|${e.title.toLowerCase()}`)
    )
    const toInsert = approvedWork
      .filter(e => !existingKeys.has(`${e.company.toLowerCase()}|${e.title.toLowerCase()}`))
      .map((e, i) => ({
        user_id: user.id,
        company: e.company,
        title: e.title,
        start_date: e.start_date,
        end_date: e.end_date,
        is_current: e.is_current,
        description: e.description,
        display_order: i,
      }))
    if (toInsert.length > 0) {
      const { error: whErr } = await supabase.from('work_history').insert(toInsert)
      if (!whErr) {
        workHistoryAdded = toInsert.length
        await supabase.from('match_scores').update({ is_stale: true }).eq('user_id', user.id)
      }
    }
  }

  // ── Education ──────────────────────────────────────────────────────────────
  let educationAdded = 0
  const approvedEdu = approved.education
    .map(i => analysis.education[i])
    .filter(Boolean)

  if (approvedEdu.length > 0) {
    const { data: existingEdu } = await supabase
      .from('education').select('school').eq('user_id', user.id)
    const existingSchools = new Set((existingEdu ?? []).map(e => e.school.toLowerCase()))
    const toInsert = approvedEdu
      .filter(e => !existingSchools.has(e.school.toLowerCase()))
      .map((e, i) => ({
        user_id: user.id,
        school: e.school,
        degree: e.degree,
        field_of_study: e.field_of_study,
        graduation_year: e.graduation_year,
        gpa: e.gpa,
        display_order: i,
      }))
    if (toInsert.length > 0) {
      const { error: eduErr } = await supabase.from('education').insert(toInsert)
      if (!eduErr) educationAdded = toInsert.length
    }
  }

  // ── Q&A pairs ──────────────────────────────────────────────────────────────
  let answersGenerated = 0
  const approvedQA = approved.qa_pairs
    .map(i => analysis.qa_pairs[i])
    .filter(Boolean)

  if (approvedQA.length > 0) {
    const { data: existingAnswers } = await supabase
      .from('saved_answers').select('question').eq('user_id', user.id)
    const existingQs = new Set((existingAnswers ?? []).map(r => r.question.toLowerCase()))
    const toInsert = approvedQA
      .filter(p => !existingQs.has(p.question.toLowerCase()))
      .map(p => ({ user_id: user.id, question: p.question, answer: p.answer }))
    if (toInsert.length > 0) {
      await supabase.from('saved_answers').insert(toInsert)
      answersGenerated = toInsert.length
    }
  }

  return Response.json({
    skills_extracted: skillsExtracted,
    answers_generated: answersGenerated,
    work_history_added: workHistoryAdded,
    education_added: educationAdded,
    profile_fields_filled: profileFieldsFilled,
  })
}
