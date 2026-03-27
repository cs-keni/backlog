import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractTextFromPdf } from '@/lib/pdf/parser'

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

  // Upload to Supabase Storage (use admin client to bypass RLS)
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
    // Continue even if extraction fails — store the file, just no text
  }

  // Update users row
  const { error: updateError } = await supabase
    .from('users')
    .update({ resume_url: publicUrl, resume_text: resumeText || null })
    .eq('id', user.id)

  if (updateError) {
    console.error('[POST /api/profile/resume] db update error', updateError)
    return Response.json({ error: 'Failed to save resume info' }, { status: 500 })
  }

  // Mark all match scores stale — resume changed
  await supabase
    .from('match_scores')
    .update({ is_stale: true })
    .eq('user_id', user.id)

  return Response.json({
    resume_url: publicUrl,
    resume_text_length: resumeText.length,
  })
}
