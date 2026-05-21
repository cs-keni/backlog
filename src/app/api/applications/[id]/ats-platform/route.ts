import { createClient } from '@/lib/supabase/server'
import { KNOWN_ATS_PLATFORMS } from '@/lib/tracker/ats-platform'

const VALID_PLATFORMS = new Set<string>([...KNOWN_ATS_PLATFORMS, 'unknown'])

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { ats_platform?: unknown } | null
  if (!body || typeof body.ats_platform !== 'string' || !VALID_PLATFORMS.has(body.ats_platform)) {
    return Response.json({ error: 'Invalid ATS platform' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('applications')
    .update({ ats_platform: body.ats_platform, last_updated: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, ats_platform')
    .single()

  if (error || !data) {
    return Response.json({ error: 'Application not found' }, { status: 404 })
  }

  return Response.json(data)
}
