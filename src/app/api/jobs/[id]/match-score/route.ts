import { createClient } from '@/lib/supabase/server'
import { computeMatchScore } from '@/lib/llm/matcher'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Check cache
  const { data: cached } = await supabase
    .from('match_scores')
    .select('*')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .single()

  if (cached && !cached.is_stale) {
    return Response.json({ score: cached.score, rationale: cached.rationale, mode: 'cached' })
  }

  // Fetch user profile and job in parallel
  const [profileResult, jobResult] = await Promise.all([
    supabase.from('users').select('skills, resume_text').eq('id', user.id).single(),
    supabase.from('jobs').select('title, company, tags, description').eq('id', jobId).single(),
  ])

  if (profileResult.error || !profileResult.data) {
    return Response.json({ error: 'Profile not found' }, { status: 404 })
  }
  if (jobResult.error || !jobResult.data) {
    return Response.json({ error: 'Job not found' }, { status: 404 })
  }

  const profile = profileResult.data
  const job = jobResult.data

  const result = await computeMatchScore({
    skills: profile.skills,
    resumeText: profile.resume_text,
    jobTags: job.tags,
    jobDescription: job.description,
    jobTitle: job.title,
    company: job.company,
  })

  if (result.mode === 'none') {
    return Response.json({ score: null, rationale: null, mode: 'none' })
  }

  // Upsert into cache
  await supabase.from('match_scores').upsert(
    {
      user_id: user.id,
      job_id: jobId,
      score: result.score,
      rationale: result.rationale,
      computed_at: new Date().toISOString(),
      is_stale: false,
    },
    { onConflict: 'user_id,job_id' }
  )

  return Response.json({ score: result.score, rationale: result.rationale, mode: result.mode })
}
