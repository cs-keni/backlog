import { createClient } from '@/lib/supabase/server'
import type { CoverLetterTemplate } from '@/lib/llm/cover-letter'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: { content?: string; template_type?: string }
  try {
    body = await request.json() as { content?: string; template_type?: string }
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.content === 'string') updates.content = body.content

  const validTemplates: CoverLetterTemplate[] = ['formal', 'casual', 'startup']
  if (validTemplates.includes(body.template_type as CoverLetterTemplate)) {
    updates.template_type = body.template_type
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cover_letters')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, template_type, content')
    .single()

  if (error || !data) {
    console.error('[PATCH /api/cover-letter/[id]]', error)
    return Response.json({ error: 'Failed to update cover letter' }, { status: 500 })
  }

  return Response.json(data)
}
