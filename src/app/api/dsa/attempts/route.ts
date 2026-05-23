import { createClient } from '@supabase/supabase-js'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'

const VALID_PHASES = ['read', 'brute_force', 'pattern', 'code'] as const
const VALID_LANGUAGES = ['python', 'java', 'js'] as const

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    attempt_id,
    problem_slug,
    phase_reached,
    time_spent_sec,
    hint_count,
    hint_layers_revealed,
    language,
  } = body

  if (!attempt_id || typeof attempt_id !== 'string') {
    return Response.json({ error: 'attempt_id required' }, { status: 400 })
  }
  if (!problem_slug || typeof problem_slug !== 'string') {
    return Response.json({ error: 'problem_slug required' }, { status: 400 })
  }
  if (!VALID_PHASES.includes(phase_reached as typeof VALID_PHASES[number])) {
    return Response.json({ error: 'Invalid phase_reached' }, { status: 400 })
  }
  if (!VALID_LANGUAGES.includes(language as typeof VALID_LANGUAGES[number])) {
    return Response.json({ error: 'Invalid language' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase.from('lc_attempts').upsert(
    {
      attempt_id,
      user_id: auth.userId,
      problem_slug,
      phase_reached,
      time_spent_sec: typeof time_spent_sec === 'number' ? time_spent_sec : 0,
      hint_count: typeof hint_count === 'number' ? hint_count : 0,
      hint_layers_revealed: Array.isArray(hint_layers_revealed) ? hint_layers_revealed : [],
      language,
    },
    { onConflict: 'attempt_id' }
  )

  if (error) {
    console.error('[DSA attempts] DB error:', error)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
