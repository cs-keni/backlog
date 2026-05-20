import { createClient } from '@/lib/supabase/server'
import { DSAClient } from '@/components/dsa/DSAClient'
import type { LcSolveWithReviews } from '@/lib/dsa/types'
import { getTodayLocal } from '@/lib/dsa/schedule'

export const dynamic = 'force-dynamic'

export default async function DSAPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getTodayLocal()
  const [{ data }, { count: newSolvesToday }] = await Promise.all([
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
  ])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-zinc-100">DSA</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <DSAClient
          initialSolves={(data ?? []) as unknown as LcSolveWithReviews[]}
          initialNewSolvesToday={newSolvesToday ?? 0}
        />
      </div>
    </div>
  )
}
