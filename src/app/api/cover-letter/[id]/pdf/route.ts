import { createClient } from '@/lib/supabase/server'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generateCoverLetterPDF } from '@/lib/pdf/cover-letter-generator'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let userId = user?.id ?? null
  if (!userId) {
    const apiAuth = await verifyApiKeyFromRequest(request)
    if (!apiAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    userId = apiAuth.userId
    supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as unknown as Awaited<ReturnType<typeof createClient>>
  }

  const { id } = await params

  const { data: letter } = await supabase
    .from('cover_letters')
    .select('content, template_type')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!letter) return Response.json({ error: 'Cover letter not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email, phone')
    .eq('id', userId)
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
