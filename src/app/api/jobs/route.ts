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
  const cursor = searchParams.get('cursor') // ISO timestamp — posted_at of last item
  const cursorId = searchParams.get('cursorId') // id of last item (tiebreak)
  const limit = 25

  // Filters
  const location = searchParams.get('location') // text search
  const isRemote = searchParams.get('is_remote') // 'true' | 'false' | null
  const salaryMin = searchParams.get('salary_min')
  const experienceLevel = searchParams.get('experience_level') // entry | mid | senior
  const roleType = searchParams.get('role_type') // full_time | internship | contract
  const sort = searchParams.get('sort') ?? 'newest' // newest | salary

  let query = supabase
    .from('jobs')
    .select(
      `
      id,
      title,
      company,
      company_id,
      location,
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
      company_profiles (
        id,
        name,
        description,
        headcount_range,
        funding_stage
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

  // Cursor-based pagination (posted_at DESC, id DESC)
  if (cursor && cursorId) {
    query = query.or(
      `posted_at.lt.${cursor},and(posted_at.eq.${cursor},id.lt.${cursorId})`
    )
  }

  // Filters
  if (isRemote === 'true') query = query.eq('is_remote', true)
  if (isRemote === 'false') query = query.eq('is_remote', false)
  if (location) query = query.ilike('location', `%${location}%`)
  if (salaryMin) query = query.gte('salary_min', parseInt(salaryMin, 10))
  if (experienceLevel) query = query.eq('experience_level', experienceLevel)
  if (roleType) query = query.eq('role_type', roleType)

  // Sort
  if (sort === 'salary') {
    query = query.order('salary_min', { ascending: false, nullsFirst: false })
  }
  // Always secondary sort by posted_at + id for stable cursor pagination
  query = query
    .order('posted_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/jobs]', error)
    return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }

  const jobs = data ?? []
  const last = jobs[jobs.length - 1]
  const nextCursor = jobs.length === limit && last
    ? { cursor: last.posted_at, cursorId: last.id }
    : null

  return Response.json({ jobs, nextCursor })
}
