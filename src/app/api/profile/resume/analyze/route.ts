export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { analyzeResume } from '@/lib/llm/resume-analyzer'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('resume_text, full_name, phone, address, skills')
    .eq('id', user.id)
    .single()

  if (!profile?.resume_text || profile.resume_text.length < 100) {
    return Response.json({ error: 'No resume text found — please re-upload your resume' }, { status: 400 })
  }

  const analysis = await analyzeResume(profile.resume_text)

  // ── Personal info ────────────────────────────────────────────────────────
  const personalUpdates: Record<string, unknown> = {}
  const profileFieldsFilled: string[] = []

  if (!profile.full_name && analysis.personal_info.full_name) {
    personalUpdates.full_name = analysis.personal_info.full_name
    profileFieldsFilled.push('full_name')
  }
  if (!profile.phone && analysis.personal_info.phone) {
    personalUpdates.phone = analysis.personal_info.phone
    profileFieldsFilled.push('phone')
  }
  if (!profile.address && analysis.personal_info.address) {
    personalUpdates.address = analysis.personal_info.address
    profileFieldsFilled.push('address')
  }

  // ── Skills ───────────────────────────────────────────────────────────────
  let skillsExtracted: string[] = []
  if (analysis.skills.length > 0) {
    const existing: string[] = profile.skills ?? []
    const existingLower = new Set(existing.map(s => s.toLowerCase()))
    const newSkills = analysis.skills.filter(s => !existingLower.has(s.toLowerCase()))
    const merged = [...existing, ...newSkills]
    personalUpdates.skills = merged
    skillsExtracted = newSkills.length > 0 ? newSkills : analysis.skills
  }

  if (Object.keys(personalUpdates).length > 0) {
    await supabase.from('users').update(personalUpdates).eq('id', user.id)
  }

  // ── Work history ─────────────────────────────────────────────────────────
  let workHistoryAdded = 0
  if (analysis.work_history.length > 0) {
    const { data: existingWork } = await supabase
      .from('work_history')
      .select('company, title')
      .eq('user_id', user.id)

    const existingKeys = new Set(
      (existingWork ?? []).map(e => `${e.company.toLowerCase()}|${e.title.toLowerCase()}`)
    )

    const toInsert = analysis.work_history
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
      if (!whErr) workHistoryAdded = toInsert.length
    }
  }

  // ── Education ────────────────────────────────────────────────────────────
  let educationAdded = 0
  if (analysis.education.length > 0) {
    const { data: existingEdu } = await supabase
      .from('education')
      .select('school')
      .eq('user_id', user.id)

    const existingSchools = new Set(
      (existingEdu ?? []).map(e => e.school.toLowerCase())
    )

    const toInsert = analysis.education
      .filter(e => !existingSchools.has(e.school.toLowerCase()))
      .map((e, i) => ({
        user_id: user.id,
        school: e.school,
        degree: e.degree,
        field_of_study: e.field_of_study,
        graduation_year: e.graduation_year,
        display_order: i,
      }))

    if (toInsert.length > 0) {
      const { error: eduErr } = await supabase.from('education').insert(toInsert)
      if (!eduErr) educationAdded = toInsert.length
    }
  }

  // ── Q&A pairs ────────────────────────────────────────────────────────────
  let answersGenerated = 0
  if (analysis.qa_pairs.length > 0) {
    const { data: existing } = await supabase
      .from('saved_answers')
      .select('question')
      .eq('user_id', user.id)

    const existingQs = new Set((existing ?? []).map(r => r.question.toLowerCase()))
    const toInsert = analysis.qa_pairs
      .filter(p => !existingQs.has(p.question.toLowerCase()))
      .map(p => ({ user_id: user.id, question: p.question, answer: p.answer }))

    if (toInsert.length > 0) {
      await supabase.from('saved_answers').insert(toInsert)
      answersGenerated = toInsert.length
    }
  }

  return Response.json({
    skills_extracted: skillsExtracted,
    all_skills: analysis.skills,
    answers_generated: answersGenerated,
    work_history_added: workHistoryAdded,
    education_added: educationAdded,
    profile_fields_filled: profileFieldsFilled,
  })
}
