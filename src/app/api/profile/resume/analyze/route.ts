export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { analyzeResume } from '@/lib/llm/resume-analyzer'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('resume_text, skills')
    .eq('id', user.id)
    .single()

  if (!profile?.resume_text || profile.resume_text.length < 100) {
    return Response.json({ error: 'No resume text found — please re-upload your resume' }, { status: 400 })
  }

  const analysis = await analyzeResume(profile.resume_text)

  // Merge skills
  let skillsExtracted: string[] = []
  if (analysis.skills.length > 0) {
    const existing: string[] = profile.skills ?? []
    const existingLower = new Set(existing.map(s => s.toLowerCase()))
    const newSkills = analysis.skills.filter(s => !existingLower.has(s.toLowerCase()))
    const merged = [...existing, ...newSkills]
    await supabase.from('users').update({ skills: merged }).eq('id', user.id)
    skillsExtracted = newSkills
    // If no new skills, still return all extracted so UI can show them
    if (newSkills.length === 0) skillsExtracted = analysis.skills
  }

  // Save Q&A — skip duplicates
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
  })
}
