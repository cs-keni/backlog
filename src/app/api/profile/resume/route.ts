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

  // AI analysis — extract skills + generate Q&A answers
  let skillsExtracted: string[] = []
  let answersGenerated = 0

  if (resumeText.length > 100) {
    try {
      const analysis = await analyzeResume(resumeText)

      // Merge extracted skills with existing (deduplicate, preserve existing order)
      if (analysis.skills.length > 0) {
        const { data: profileRow } = await supabase
          .from('users')
          .select('skills')
          .eq('id', user.id)
          .single()

        const existing: string[] = profileRow?.skills ?? []
        const existingLower = new Set(existing.map(s => s.toLowerCase()))
        const newSkills = analysis.skills.filter(s => !existingLower.has(s.toLowerCase()))
        const merged = [...existing, ...newSkills]

        await supabase
          .from('users')
          .update({ skills: merged })
          .eq('id', user.id)

        skillsExtracted = newSkills
      }

      // Save Q&A pairs to saved_answers (skip duplicates by question text)
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
  })
}
