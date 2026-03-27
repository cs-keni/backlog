export const maxDuration = 60 // seconds — needed for PDF extraction + LLM analysis

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractTextFromPdf } from '@/lib/pdf/parser'
import { analyzeResume } from '@/lib/llm/resume-analyzer'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('resume')
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return Response.json({ error: 'Only PDF files are accepted' }, { status: 400 })
  }

  const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File must be under 5 MB' }, { status: 400 })
  }

  // Upload to Supabase Storage (admin client bypasses RLS)
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const fileName = `${user.id}/resume.pdf`
  const adminSupabase = createAdminClient()

  const { error: uploadError } = await adminSupabase.storage
    .from('resumes')
    .upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    console.error('[POST /api/profile/resume] upload error', uploadError)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = adminSupabase.storage
    .from('resumes')
    .getPublicUrl(fileName)

  // Extract text
  let resumeText = ''
  try {
    resumeText = await extractTextFromPdf(buffer)
  } catch (err) {
    console.error('[POST /api/profile/resume] pdf parse error', err)
  }

  // Update users row with file URL and raw text
  const { error: updateError } = await supabase
    .from('users')
    .update({ resume_url: publicUrl, resume_text: resumeText || null })
    .eq('id', user.id)

  if (updateError) {
    console.error('[POST /api/profile/resume] db update error', updateError)
    return Response.json({ error: 'Failed to save resume info' }, { status: 500 })
  }

  // Mark match scores stale
  await supabase
    .from('match_scores')
    .update({ is_stale: true })
    .eq('user_id', user.id)

  // AI analysis
  let skillsExtracted: string[] = []
  let answersGenerated = 0
  let workHistoryAdded = 0
  let educationAdded = 0
  const profileFieldsFilled: string[] = []

  if (resumeText.length > 100) {
    try {
      const analysis = await analyzeResume(resumeText)

      // ── Personal info ──────────────────────────────────────────────────────
      // Only fill fields that are currently null/empty in the DB
      const { data: currentProfile } = await supabase
        .from('users')
        .select('full_name, phone, address, skills')
        .eq('id', user.id)
        .single()

      const personalUpdates: Record<string, unknown> = {}
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

      // ── Skills ────────────────────────────────────────────────────────────
      if (analysis.skills.length > 0) {
        const existing: string[] = currentProfile?.skills ?? []
        const existingLower = new Set(existing.map(s => s.toLowerCase()))
        const newSkills = analysis.skills.filter(s => !existingLower.has(s.toLowerCase()))
        const merged = [...existing, ...newSkills]
        personalUpdates.skills = merged
        skillsExtracted = newSkills.length > 0 ? newSkills : analysis.skills
      }

      if (Object.keys(personalUpdates).length > 0) {
        await supabase.from('users').update(personalUpdates).eq('id', user.id)
      }

      // ── Work history ──────────────────────────────────────────────────────
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

      // ── Education ─────────────────────────────────────────────────────────
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

      // ── Q&A pairs ─────────────────────────────────────────────────────────
      if (analysis.qa_pairs.length > 0) {
        const { data: existingAnswers } = await supabase
          .from('saved_answers')
          .select('question')
          .eq('user_id', user.id)

        const existingQs = new Set((existingAnswers ?? []).map(r => r.question.toLowerCase()))
        const toInsert = analysis.qa_pairs
          .filter(p => !existingQs.has(p.question.toLowerCase()))
          .map(p => ({ user_id: user.id, question: p.question, answer: p.answer }))

        if (toInsert.length > 0) {
          await supabase.from('saved_answers').insert(toInsert)
          answersGenerated = toInsert.length
        }
      }
    } catch (err) {
      console.error('[POST /api/profile/resume] analysis error', err)
      // Non-fatal — upload already succeeded
    }
  }

  return Response.json({
    resume_url: publicUrl,
    resume_text_length: resumeText.length,
    skills_extracted: skillsExtracted,
    answers_generated: answersGenerated,
    work_history_added: workHistoryAdded,
    education_added: educationAdded,
    profile_fields_filled: profileFieldsFilled,
  })
}
