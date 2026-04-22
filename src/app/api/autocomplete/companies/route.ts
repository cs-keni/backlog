import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q') ?? ''

  // Fetch companies the user has previously applied to
  const { data: applied } = await supabase
    .from('applications')
    .select('jobs(company)')
    .eq('user_id', user.id)

  const appliedSet = new Set(
    (applied ?? [])
      .map((a) => (a.jobs as unknown as { company: string } | null)?.company)
      .filter((c): c is string => typeof c === 'string' && c.length > 0)
  )

  // Search company_profiles by name
  let cpQuery = supabase
    .from('company_profiles')
    .select('name')
    .order('name', { ascending: true })
    .limit(30)

  if (q.trim()) {
    cpQuery = cpQuery.ilike('name', `%${q.trim()}%`)
  }

  const { data: companies } = await cpQuery

  const names = (companies ?? [])
    .map((c) => c.name as string)
    .filter((n) => n?.length > 0)

  // Applied-before companies float to the top
  const sorted = [
    ...names.filter((n) => appliedSet.has(n)),
    ...names.filter((n) => !appliedSet.has(n)),
  ]

  const suggestions = sorted.slice(0, 8).map((name) => ({
    value: name,
    meta: appliedSet.has(name) ? 'applied before' : undefined,
  }))

  return Response.json({ suggestions })
}
