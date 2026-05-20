import { createClient } from '@/lib/supabase/server'
import { FeedFilters } from '@/lib/jobs/types'

const MAX_PRESETS = 20
const MAX_NAME_LENGTH = 50

type PresetFilters = FeedFilters & { version: 1 }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePresetFilters(value: unknown): PresetFilters | null {
  if (!isRecord(value) || value.version !== 1) return null

  const isRemote = value.isRemote
  const country = value.country
  const dateRange = value.dateRange

  if (!['all', 'remote', 'onsite'].includes(String(isRemote))) return null
  if (!['all', 'us', 'international'].includes(String(country))) return null
  if (!['', '24h', '7d', '30d', '1y'].includes(String(dateRange))) return null

  const fields = ['search', 'location', 'salaryMin', 'experienceLevel', 'roleType'] as const
  for (const field of fields) {
    if (typeof value[field] !== 'string') return null
  }

  const search = value.search as string
  const location = value.location as string
  const salaryMin = value.salaryMin as string
  const experienceLevel = value.experienceLevel as string
  const roleType = value.roleType as string

  return {
    version: 1,
    search,
    location,
    isRemote: isRemote as PresetFilters['isRemote'],
    country: country as PresetFilters['country'],
    salaryMin,
    experienceLevel,
    roleType,
    dateRange: dateRange as PresetFilters['dateRange'],
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('filter_presets')
    .select('id, user_id, name, filters, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[GET /api/filter-presets]', error)
    return Response.json({ error: 'Failed to fetch presets' }, { status: 500 })
  }

  return Response.json({ presets: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return Response.json({ error: 'Preset name is required' }, { status: 422 })
  }
  if (name.length > MAX_NAME_LENGTH) {
    return Response.json({ error: 'Preset name must be 50 characters or fewer' }, { status: 422 })
  }

  const filters = parsePresetFilters(body.filters)
  if (!filters) {
    return Response.json({ error: 'Invalid preset filters' }, { status: 422 })
  }

  const { count, error: countError } = await supabase
    .from('filter_presets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    console.error('[POST /api/filter-presets count]', countError)
    return Response.json({ error: 'Failed to count presets' }, { status: 500 })
  }

  if ((count ?? 0) >= MAX_PRESETS) {
    return Response.json({ error: "You've reached the 20 preset limit" }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('filter_presets')
    .insert({ user_id: user.id, name, filters })
    .select('id, user_id, name, filters, created_at')
    .single()

  if (error) {
    console.error('[POST /api/filter-presets]', error)
    if (error.code === '23514') {
      return Response.json({ error: "You've reached the 20 preset limit" }, { status: 422 })
    }
    return Response.json({ error: 'Failed to save preset' }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
