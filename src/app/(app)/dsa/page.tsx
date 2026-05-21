import { createClient } from '@/lib/supabase/server'
import { DSAClient } from '@/components/dsa/DSAClient'
import type { LcSolveWithReviews } from '@/lib/dsa/types'
import type { DsaTrack } from '@/lib/dsa/neetcode150'
import { getTodayLocal } from '@/lib/dsa/schedule'

export const dynamic = 'force-dynamic'

export default async function DSAPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getTodayLocal()
  const [{ data }, { count: newSolvesToday }, { data: userPrefs }, { data: technicalApps }] = await Promise.all([
    supabase
      .from('lc_solves')
      .select('*, lc_reviews(*)')
      .eq('user_id', user.id)
      .order('solved_at', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('daily_activity')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('is_new_solve', true),
    supabase
      .from('users')
      .select('dsa_track')
      .eq('id', user.id)
      .single(),
    supabase
      .from('applications')
      .select('applied_at, jobs(company)')
      .eq('user_id', user.id)
      .in('status', ['technical', 'final'])
      .eq('is_archived', false)
      .order('applied_at', { ascending: false }),
  ])

  const initialTrack: DsaTrack =
    userPrefs?.dsa_track === '75' || userPrefs?.dsa_track === '250'
      ? userPrefs.dsa_track
      : '150'

  const openTechnicalApps = (technicalApps ?? [])
    .map((app) => {
      const jobs = app.jobs as { company?: unknown } | { company?: unknown }[] | null
      const job = Array.isArray(jobs) ? jobs[0] : jobs
      return {
        company: typeof job?.company === 'string' ? job.company : '',
        applied_at: typeof app.applied_at === 'string' ? app.applied_at : null,
      }
    })
    .filter(app => app.company)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <DSAClient
          initialSolves={(data ?? []) as unknown as LcSolveWithReviews[]}
          initialNewSolvesToday={newSolvesToday ?? 0}
          initialTrack={initialTrack}
          openTechnicalApps={openTechnicalApps}
        />
      </div>
    </div>
  )
}
