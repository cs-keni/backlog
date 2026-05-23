import { createClient } from '@/lib/supabase/server'
import type { DsaTrack } from '@/lib/dsa/neetcode150'
import { TRACK_PROBLEMS } from '@/lib/dsa/neetcode150'
import { NEETCODE_250 } from '@/lib/dsa/neetcode150'

const VALID_TRACKS: DsaTrack[] = ['75', '150', '250']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('users')
    .select('dsa_track')
    .eq('id', user.id)
    .single()

  const track: DsaTrack =
    data?.dsa_track === '75' || data?.dsa_track === '250' ? data.dsa_track : '150'

  // Non-premium problem count per track
  const nonPremiumCount = NEETCODE_250.filter(
    p => TRACK_PROBLEMS[track].has(p.slug) && !p.leetcodePremium
  ).length

  return Response.json({ track, total: nonPremiumCount })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { track?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.track !== 'string' || !VALID_TRACKS.includes(body.track as DsaTrack)) {
    return Response.json({ error: 'Invalid track' }, { status: 400 })
  }

  const track = body.track as DsaTrack
  const { error } = await supabase
    .from('users')
    .update({ dsa_track: track })
    .eq('id', user.id)

  if (error) {
    console.error('[PATCH /api/dsa/track]', error)
    return Response.json({ error: 'Failed to update DSA track' }, { status: 500 })
  }

  return Response.json({ track })
}
