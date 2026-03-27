import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return Response.json({ error: 'Failed to fetch profile' }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Whitelist updatable fields — never let client overwrite id, email, resume_text, resume_url
  const allowed = [
    'full_name', 'phone', 'address',
    'linkedin_url', 'github_url', 'portfolio_url',
    'citizenship_status', 'visa_sponsorship_required', 'willing_to_relocate',
    'preferred_locations', 'preferred_salary_min', 'preferred_role_types', 'remote_preference',
    'skills', 'experience_level', 'years_of_experience',
    'notification_email', 'notification_push', 'notification_sms',
    'notification_quiet_hours_start', 'notification_quiet_hours_end',
    'alert_match_threshold',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select('*')
    .single()

  if (error) {
    console.error('[PATCH /api/profile]', error)
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }

  // If skills changed, mark all match scores as stale
  if ('skills' in updates) {
    await supabase
      .from('match_scores')
      .update({ is_stale: true })
      .eq('user_id', user.id)
  }

  return Response.json(data)
}
