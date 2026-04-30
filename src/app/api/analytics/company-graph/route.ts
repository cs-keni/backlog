import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface GraphNode {
  id: string
  name: string
  roleCount: number
  applicationStatus: string | null
  initials: string
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
}

export interface CompanyGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const t of a) if (b.has(t)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// Status priority — higher index wins when a company has multiple applications
const STATUS_PRIORITY = ['saved', 'applied', 'phone_screen', 'technical', 'final', 'offer', 'rejected']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Jobs in the last 90 days (wider window for a useful graph even with sparse data)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const [jobsResult, appsResult] = await Promise.all([
    supabase
      .from('jobs')
      .select('company, company_id, tags')
      .eq('hide_from_feed', false)
      .gte('fetched_at', cutoff.toISOString()),
    supabase
      .from('applications')
      .select('status, jobs(company)')
      .eq('user_id', user.id),
  ])

  const jobs = (jobsResult.data ?? []) as Array<{
    company: string
    company_id: string | null
    tags: string[] | null
  }>

  // Supabase join returns jobs as object (many-to-one FK); cast via unknown to handle generated type mismatch
  const apps = (appsResult.data ?? []) as unknown as Array<{
    status: string
    jobs: { company: string } | null
  }>

  // ── Aggregate companies ──────────────────────────────────────────────────────

  const companyMap = new Map<
    string,
    { id: string; name: string; tags: Set<string>; count: number }
  >()

  for (const job of jobs) {
    const key = job.company_id ?? job.company
    const existing = companyMap.get(key)
    if (existing) {
      existing.count++
      for (const t of job.tags ?? []) existing.tags.add(t.toLowerCase())
    } else {
      companyMap.set(key, {
        id: key,
        name: job.company,
        tags: new Set((job.tags ?? []).map((t) => t.toLowerCase())),
        count: 1,
      })
    }
  }

  // ── User application status per company (best/highest priority) ──────────────

  const appStatusByCompany = new Map<string, string>()
  for (const app of apps) {
    const co = app.jobs?.company
    if (!co) continue
    const existing = appStatusByCompany.get(co)
    const newPriority = STATUS_PRIORITY.indexOf(app.status)
    const existingPriority = existing ? STATUS_PRIORITY.indexOf(existing) : -1
    if (newPriority > existingPriority) appStatusByCompany.set(co, app.status)
  }

  // ── Build nodes — top 60 by role count ──────────────────────────────────────

  const sorted = [...companyMap.values()].sort((a, b) => b.count - a.count).slice(0, 60)

  const nodes: GraphNode[] = sorted.map((c) => ({
    id: c.id,
    name: c.name,
    roleCount: c.count,
    applicationStatus: appStatusByCompany.get(c.name) ?? null,
    initials: initials(c.name),
  }))

  // ── Build edges — Jaccard ≥ 0.25 between node pairs ─────────────────────────

  const edges: GraphEdge[] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!
      const b = sorted[j]!
      if (a.tags.size === 0 || b.tags.size === 0) continue
      const score = jaccard(a.tags, b.tags)
      if (score >= 0.25) {
        edges.push({ source: a.id, target: b.id, weight: score })
      }
    }
  }

  return Response.json({ nodes, edges } satisfies CompanyGraphData)
}
