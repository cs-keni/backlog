import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PINNED = ['Remote', 'Hybrid']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q') ?? ''

  let dbQuery = supabase
    .from('jobs')
    .select('location')
    .eq('hide_from_feed', false)
    .not('location', 'is', null)
    .limit(200)

  if (q.trim()) {
    dbQuery = dbQuery.ilike('location', `%${q.trim()}%`)
  } else {
    dbQuery = dbQuery.order('fetched_at', { ascending: false })
  }

  const { data: rows } = await dbQuery

  // Deduplicate preserving order
  const seen = new Set<string>()
  const locations: string[] = []
  for (const row of rows ?? []) {
    const loc = row.location as string | null
    if (loc && !seen.has(loc)) {
      seen.add(loc)
      locations.push(loc)
    }
  }

  // Filter pinned values from DB results to avoid duplication
  const dbLocations = locations.filter(
    (l) => !PINNED.some((p) => p.toLowerCase() === l.toLowerCase())
  )

  // Pinned entries only shown if they match the query (or no query)
  const pinnedFiltered = q.trim()
    ? PINNED.filter((p) => p.toLowerCase().includes(q.toLowerCase()))
    : PINNED

  const all = [...pinnedFiltered, ...dbLocations].slice(0, 8)

  return Response.json({
    suggestions: all.map((value) => ({ value })),
  })
}
