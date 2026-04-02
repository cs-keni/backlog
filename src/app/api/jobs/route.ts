import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  // Cursor is fetched_at (ISO timestamp) + id — fetched_at is always non-null, safe for pagination
  const cursor = searchParams.get('cursor')
  const cursorId = searchParams.get('cursorId')
  const limit = 25

  // Filters
  const location = searchParams.get('location')
  const isRemote = searchParams.get('is_remote') // 'true' | 'false' | null
  const country = searchParams.get('country') // 'us' | 'international' | null
  const salaryMin = searchParams.get('salary_min')
  const experienceLevel = searchParams.get('experience_level')
  const roleType = searchParams.get('role_type') // 'full_time' | 'internship' | 'contract'
  const dateRange = searchParams.get('date_range') // '24h' | '7d' | '30d' | '1y' | null
  const sort = searchParams.get('sort') ?? 'newest'

  let query = supabase
    .from('jobs')
    .select(
      `
      id,
      title,
      company,
      company_id,
      location,
      country,
      salary_min,
      salary_max,
      url,
      source,
      posted_at,
      fetched_at,
      description,
      tags,
      is_remote,
      experience_level,
      role_type,
      company_profiles (
        id,
        name,
        description,
        mission,
        notable_products,
        website_url,
        headcount_range,
        funding_stage,
        tech_stack,
        enriched_at
      ),
      applications!left (
        id,
        status
      )
      `,
      { count: 'exact' }
    )
    // RLS scopes applications to the current user automatically
    .eq('applications.user_id', user.id)

  // Cursor-based pagination using fetched_at + id.
  // fetched_at is always non-null so it's safe to paginate on.
  if (cursor && cursorId) {
    query = query.or(
      `fetched_at.lt.${cursor},and(fetched_at.eq.${cursor},id.lt.${cursorId})`
    )
  }

  // Filters
  if (isRemote === 'true') query = query.eq('is_remote', true)
  if (isRemote === 'false') query = query.eq('is_remote', false)
  // "us" includes jobs with country = 'United States' OR null (unlabeled remote = US default)
  if (country === 'us') query = query.or('country.eq.United States,country.is.null')
  if (country === 'international') query = query.not('country', 'eq', 'United States').not('country', 'is', null)
  if (location) query = query.ilike('location', `%${location}%`)
  if (salaryMin) query = query.gte('salary_min', parseInt(salaryMin, 10))
  if (experienceLevel) query = query.eq('experience_level', experienceLevel)
  if (roleType) query = query.eq('role_type', roleType)
  if (dateRange) {
    const cutoff = new Date()
    if (dateRange === '24h') cutoff.setDate(cutoff.getDate() - 1)
    else if (dateRange === '7d') cutoff.setDate(cutoff.getDate() - 7)
    else if (dateRange === '30d') cutoff.setDate(cutoff.getDate() - 30)
    else if (dateRange === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1)
    query = query.gte('posted_at', cutoff.toISOString())
  }

  // Sort — always use fetched_at + id as the stable pagination key
  if (sort === 'salary') {
    query = query.order('salary_min', { ascending: false, nullsFirst: false })
  }
  query = query
    .order('fetched_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/jobs]', error)
    return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }

  const jobs = data ?? []
  const last = jobs[jobs.length - 1]
  const nextCursor =
    jobs.length === limit && last
      ? { cursor: last.fetched_at, cursorId: last.id }
      : null

  return Response.json({ jobs, nextCursor })
}
