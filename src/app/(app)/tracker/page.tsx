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
      id, status, applied_at, last_updated, notes, recruiter_name, recruiter_email,
      jobs (
        id, title, company, location, salary_min, salary_max, url, is_remote, tags
      )
    `)
    .eq('user_id', user.id)
    .order('last_updated', { ascending: false })

  const applications = (data ?? []) as unknown as ApplicationWithJob[]

  if (applications.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-zinc-300">No applications yet</p>
          <p className="text-xs text-zinc-600 max-w-[260px] leading-relaxed">
            Save or apply to jobs from the feed — they&apos;ll appear here as cards you can drag through your pipeline.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-zinc-100">Tracker</h1>
        <span className="text-xs text-zinc-500">{applications.length} application{applications.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        <TrackerBoard initialApplications={applications} />
      </div>
    </div>
  )
}
