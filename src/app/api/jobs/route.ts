import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasE2EAuthCookie } from '@/lib/e2e/server'
import { e2eJobs } from '@/lib/e2e/fixtures'
import { hiddenSources, type SourcePreferences } from '@/lib/user/source-preferences'
import { getActiveFeedbackFilters } from '@/lib/feed/feedback-filters'
import { TITLE_BLOCKLIST, titleIsBlocked } from '@/lib/feed/title-blocklist'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (hasE2EAuthCookie(request)) {
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.toLowerCase()
    const isRemote = searchParams.get('is_remote')
    const jobs = e2eJobs.filter((job) => {
      if (titleIsBlocked(job.title)) return false
      if (search && !`${job.title} ${job.company}`.toLowerCase().includes(search)) return false
      if (isRemote === 'true' && !job.is_remote) return false
      if (isRemote === 'false' && job.is_remote) return false
      return true
    })

    return Response.json({ jobs, nextCursor: null })
  }

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

  // Filters
  const location = searchParams.get('location')
  const isRemote = searchParams.get('is_remote') // 'true' | 'false' | null
  const country = searchParams.get('country') // 'us' | 'international' | null
  const salaryMin = searchParams.get('salary_min')
  const experienceLevel = searchParams.get('experience_level')
  const roleType = searchParams.get('role_type') // 'full_time' | 'internship' | 'contract'
  const dateRange = searchParams.get('date_range') // '24h' | '7d' | '30d' | '1y' | null
  const sort = searchParams.get('sort') ?? 'newest'
  const search = searchParams.get('search')
  const limitParam = searchParams.get('limit')
  const { data: profile } = await supabase
    .from('users')
    .select('source_preferences')
    .eq('id', user.id)
    .single()
  const sourcesToHide = hiddenSources(profile?.source_preferences as SourcePreferences | null)
  const feedbackFilters = await getActiveFeedbackFilters(user.id, supabase)

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
    .eq('hide_from_feed', false)

  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 25) : 25

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
  if (search) query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%`)
  if (location) query = query.ilike('location', `%${location}%`)
  if (salaryMin) query = query.gte('salary_min', parseInt(salaryMin, 10))
  if (experienceLevel) query = query.eq('experience_level', experienceLevel)
  if (roleType) query = query.eq('role_type', roleType)
  if (sourcesToHide.length > 0) query = query.not('source', 'in', `(${sourcesToHide.join(',')})`)
  if (feedbackFilters.excludeTooFar) query = query.or('is_remote.eq.true,location.ilike.%remote%')
  if (feedbackFilters.excludeWrongStack) query = query.not('tags', 'ov', '{PHP,Ruby,WordPress,Drupal}')
  for (const pattern of TITLE_BLOCKLIST) {
    query = query.not('title', 'ilike', pattern)
  }
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
    .limit(limit as number)

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
