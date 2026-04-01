import { createClient } from '@/lib/supabase/server'
import { NotificationSettings } from '@/components/settings/NotificationSettings'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: prefs } = await supabase
    .from('users')
    .select('notification_email, notification_push, notification_quiet_hours_start, notification_quiet_hours_end, alert_match_threshold, email')
    .eq('id', user.id)
    .single()

  const { data: recentLogs } = await supabase
    .from('notification_log')
    .select('id, channel, sent_at, jobs(title, company)')
    .eq('user_id', user.id)
    .order('sent_at', { ascending: false })
    .limit(20)

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage how Backlog notifies you about new jobs.</p>
      </div>

      <NotificationSettings
        initialPrefs={{
          notification_email: prefs?.notification_email ?? false,
          notification_push: prefs?.notification_push ?? false,
          notification_quiet_hours_start: prefs?.notification_quiet_hours_start ?? null,
          notification_quiet_hours_end: prefs?.notification_quiet_hours_end ?? null,
          alert_match_threshold: prefs?.alert_match_threshold ?? 0,
          email: prefs?.email ?? user.email ?? '',
        }}
        recentLogs={(recentLogs ?? []) as unknown as NotificationLogEntry[]}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''}
      />
    </div>
  )
}

export interface NotificationLogEntry {
  id: string
  channel: string
  sent_at: string
  jobs: { title: string; company: string } | null
}
