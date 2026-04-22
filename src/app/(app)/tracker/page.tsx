import { createClient } from '@/lib/supabase/server'
import { TrackerBoard } from '@/components/tracker/TrackerBoard'
import type { ApplicationWithJob } from '@/lib/jobs/types'

export const dynamic = 'force-dynamic'

export default async function TrackerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('applications')
    .select(`
      id, status, is_archived, applied_at, last_updated, notes, recruiter_name, recruiter_email,
      jobs (
        id, title, company, location, salary_min, salary_max, url, is_remote, tags
      )
    `)
    .eq('user_id', user.id)
    .order('last_updated', { ascending: false })

  const applications = (data ?? []) as unknown as ApplicationWithJob[]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-zinc-100">Tracker</h1>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        <TrackerBoard initialApplications={applications} />
      </div>
    </div>
  )
}
