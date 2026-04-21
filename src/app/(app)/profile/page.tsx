import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from '@/components/profile/ProfileClient'
import type { UserProfile, WorkHistory, Education, SavedAnswer, Project } from '@/lib/jobs/types'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, workResult, eduResult, answersResult, projectsResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('work_history').select('*').eq('user_id', user.id).order('display_order'),
    supabase.from('education').select('*').eq('user_id', user.id).order('display_order'),
    supabase.from('saved_answers').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('projects').select('*').eq('user_id', user.id).order('display_order'),
  ])

  if (!profileResult.data) redirect('/login')

  return (
    <div className="h-full overflow-y-auto">
      <ProfileClient
        initialProfile={profileResult.data as UserProfile}
        initialWorkHistory={(workResult.data ?? []) as WorkHistory[]}
        initialEducation={(eduResult.data ?? []) as Education[]}
        initialSavedAnswers={(answersResult.data ?? []) as SavedAnswer[]}
        initialProjects={(projectsResult.data ?? []) as Project[]}
      />
    </div>
  )
}
