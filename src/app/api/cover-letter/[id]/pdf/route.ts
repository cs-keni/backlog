import { createClient } from '@/lib/supabase/server'
import { generateCoverLetterPDF } from '@/lib/pdf/cover-letter-generator'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: letter } = await supabase
    .from('cover_letters')
    .select('content, template_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!letter) return Response.json({ error: 'Cover letter not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email, phone')
    .eq('id', user.id)
    .single()

  const pdfBuffer = await generateCoverLetterPDF({
    full_name: profile?.full_name ?? 'Cover Letter',
    email: profile?.email ?? null,
    phone: profile?.phone ?? null,
    content: letter.content,
  })

  return new Response(pdfBuffer.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="cover-letter.pdf"',
    },
  })
}
