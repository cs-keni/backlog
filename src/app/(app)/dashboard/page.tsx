import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export const dynamic = 'force-dynamic'

const STATUSES = ['saved', 'applied', 'phone_screen', 'technical', 'final', 'offer', 'rejected'] as const

function buildSparkline(
  apps: Array<{ applied_at: string | null }>,
  days: number
): Array<{ date: string; count: number }> {
  const counts: Record<string, number> = {}
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    counts[d.toISOString().slice(0, 10)] = 0
  }
  for (const app of apps) {
    if (!app.applied_at) continue
    const key = app.applied_at.slice(0, 10)
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [appsResult, newestJobsResult, jobsTodayResult, profileResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, status, is_archived, applied_at, last_updated, jobs(id, title, company)')
      .eq('user_id', user.id),
    supabase
      .from('jobs')
      .select('id, title, company, location, salary_min, salary_max, tags, is_remote, posted_at, fetched_at, url')
      .order('fetched_at', { ascending: false })
      .limit(5),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .gte('fetched_at', todayStart.toISOString()),
    supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single(),
  ])

  const allApps = (appsResult.data ?? []) as Array<{
    id: string
    status: string
    is_archived: boolean
    applied_at: string | null
    last_updated: string
    jobs: { id: string; title: string; company: string } | null
  }>

  const activeApps = allApps.filter(a => !a.is_archived)

  const stats = {
    openApplications: activeApps.filter(a =>
      ['saved', 'applied', 'phone_screen', 'technical', 'final'].includes(a.status)
    ).length,
    interviews: activeApps.filter(a =>
      ['phone_screen', 'technical', 'final'].includes(a.status)
    ).length,
    offers: activeApps.filter(a => a.status === 'offer').length,
    jobsToday: jobsTodayResult.count ?? 0,
  }

  const statusCounts = Object.fromEntries(STATUSES.map(s => [s, 0])) as Record<string, number>
  for (const app of activeApps) {
    if (app.status in statusCounts) statusCounts[app.status]++
  }
  const pipeline = STATUSES.map(s => ({ status: s, count: statusCounts[s] ?? 0 }))

  const sparkline = buildSparkline(allApps, 30)

  const prepNudges = activeApps
    .filter(a => ['phone_screen', 'technical', 'final'].includes(a.status) && a.jobs)
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
    .slice(0, 4)
    .map(a => ({
      id: a.id,
      jobTitle: a.jobs!.title,
      company: a.jobs!.company,
      status: a.status,
      lastUpdated: a.last_updated,
    }))

  return (
    <DashboardClient
      stats={stats}
      newestJobs={newestJobsResult.data ?? []}
      pipeline={pipeline}
      sparkline={sparkline}
      prepNudges={prepNudges}
      userName={profileResult.data?.full_name ?? null}
    />
  )
}
