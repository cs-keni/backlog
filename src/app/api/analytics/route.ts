import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApplicationRow {
  id: string
  status: string
  is_archived: boolean
  applied_at: string | null
  last_updated: string
}

interface TimelineRow {
  application_id: string
  to_status: string
  changed_at: string
}

interface JobRow {
  company: string
  source: string
  fetched_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateSeries(days: number): Record<string, number> {
  const counts: Record<string, number> = {}
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    counts[d.toISOString().slice(0, 10)] = 0
  }
  return counts
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

const STATUSES = ['saved', 'applied', 'phone_screen', 'technical', 'final', 'offer', 'rejected'] as const

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const range = searchParams.get('range') ?? '30d'
  const days = range === '7d' ? 7 : range === '1y' ? 365 : 30

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffIso = cutoff.toISOString()

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const [appsResult, jobsResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, status, is_archived, applied_at, last_updated')
      .eq('user_id', user.id),
    supabase
      .from('jobs')
      .select('company, source, fetched_at')
      .gte('fetched_at', cutoffIso),
  ])

  const allApps = (appsResult.data ?? []) as ApplicationRow[]
  const recentJobs = (jobsResult.data ?? []) as JobRow[]

  // Fetch timeline for time-to-response calc
  const appIds = allApps.map((a) => a.id)
  const timelineResult = appIds.length > 0
    ? await supabase
        .from('application_timeline')
        .select('application_id, to_status, changed_at')
        .in('application_id', appIds)
        .order('changed_at', { ascending: true })
    : { data: [] }
  const timeline = (timelineResult.data ?? []) as TimelineRow[]

  // ── Stats ───────────────────────────────────────────────────────────────────

  const submitted = allApps.filter((a) => a.status !== 'saved')
  const gotResponse = allApps.filter((a) =>
    ['phone_screen', 'technical', 'final', 'offer', 'rejected'].includes(a.status)
  )
  const inPipeline = allApps.filter((a) =>
    ['applied', 'phone_screen', 'technical', 'final'].includes(a.status) && !a.is_archived
  )
  const offers = allApps.filter((a) => a.status === 'offer')
  const responseRate = submitted.length > 0
    ? Math.round((gotResponse.length / submitted.length) * 100)
    : 0

  // ── Application activity (applied_at within range) ──────────────────────────

  const activityCounts = dateSeries(days)
  for (const app of allApps) {
    const dateKey = app.applied_at ? toDateKey(app.applied_at) : null
    if (dateKey && dateKey in activityCounts) {
      activityCounts[dateKey] = (activityCounts[dateKey] ?? 0) + 1
    }
  }
  const applicationActivity = Object.entries(activityCounts).map(([date, count]) => ({
    date,
    count,
  }))

  // ── Funnel ──────────────────────────────────────────────────────────────────

  const statusCounts: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]))
  for (const app of allApps) {
    if (app.status in statusCounts) {
      statusCounts[app.status] = (statusCounts[app.status] ?? 0) + 1
    }
  }
  const funnel = STATUSES.map((s) => ({ status: s, count: statusCounts[s] ?? 0 }))

  // ── Jobs posted per day ──────────────────────────────────────────────────────

  const jobActivityCounts = dateSeries(days)
  for (const job of recentJobs) {
    const dateKey = toDateKey(job.fetched_at)
    if (dateKey in jobActivityCounts) {
      jobActivityCounts[dateKey] = (jobActivityCounts[dateKey] ?? 0) + 1
    }
  }
  const jobActivity = Object.entries(jobActivityCounts).map(([date, count]) => ({ date, count }))

  // ── Top hiring companies ─────────────────────────────────────────────────────

  const companyCounts: Record<string, number> = {}
  for (const job of recentJobs) {
    companyCounts[job.company] = (companyCounts[job.company] ?? 0) + 1
  }
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([company, count]) => ({ company, count }))

  // ── Source breakdown ─────────────────────────────────────────────────────────

  let githubCount = 0
  let manualCount = 0
  for (const job of recentJobs) {
    if (job.source === 'manual') manualCount++
    else githubCount++
  }

  // ── Median time to first response (days) ─────────────────────────────────────

  // For each "applied" application, find first timeline entry to a response status
  const RESPONSE_STATUSES = new Set(['phone_screen', 'technical', 'final', 'offer', 'rejected'])
  const timelineByApp: Record<string, TimelineRow[]> = {}
  for (const t of timeline) {
    if (!timelineByApp[t.application_id]) timelineByApp[t.application_id] = []
    timelineByApp[t.application_id].push(t)
  }

  const responseTimes: number[] = []
  for (const app of submitted) {
    if (!app.applied_at) continue
    const entries = timelineByApp[app.id] ?? []
    const firstResponse = entries.find((e) => RESPONSE_STATUSES.has(e.to_status))
    if (!firstResponse) continue
    const appliedAt = new Date(app.applied_at)
    const respondedAt = new Date(firstResponse.changed_at)
    const days = (respondedAt.getTime() - appliedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (days >= 0) responseTimes.push(days)
  }

  let medianDaysToResponse: number | null = null
  if (responseTimes.length > 0) {
    responseTimes.sort((a, b) => a - b)
    const mid = Math.floor(responseTimes.length / 2)
    medianDaysToResponse = responseTimes.length % 2 === 0
      ? Math.round(((responseTimes[mid - 1] ?? 0) + (responseTimes[mid] ?? 0)) / 2)
      : Math.round(responseTimes[mid] ?? 0)
  }

  return Response.json({
    stats: {
      totalApplications: allApps.length,
      submitted: submitted.length,
      inPipeline: inPipeline.length,
      responseRate,
      offers: offers.length,
      jobsInRange: recentJobs.length,
    },
    applicationActivity,
    funnel,
    jobActivity,
    topCompanies,
    sourceBreakdown: { github: githubCount, manual: manualCount },
    medianDaysToResponse,
  })
}
