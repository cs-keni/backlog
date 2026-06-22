export const maxDuration = 30
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// In-memory rate limit: 20 suggestions per user per day
const dailyLimits = new Map<string, { count: number; date: string }>()

function checkRateLimit(userId: string): boolean {
  const date = new Date().toLocaleDateString('en-CA')
  const entry = dailyLimits.get(userId)
  if (!entry || entry.date !== date) {
    dailyLimits.set(userId, { count: 1, date })
    return true
  }
  if (entry.count >= 20) return false
  entry.count += 1
  return true
}

interface SuggestProjectsBody {
  jobTitle:       string
  company:        string
  jobDescription: string
  maxProjects?:   number
}

interface ProjectRow {
  id:                  string
  name:                string
  description:         string | null
  detailed_description: string | null
  tech_stack:          string[] | null
  role:                string | null
  impact:              string | null
  highlights:          string[] | null
}

interface ProjectSuggestion {
  projectId:   string
  name:        string
  relevance:   string
  swapReason:  string
  rank:        number
}

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!checkRateLimit(auth.userId)) {
    return Response.json({ error: 'Daily suggestion limit reached (20/day)' }, { status: 429 })
  }

  let body: SuggestProjectsBody
  try {
    body = await request.json() as SuggestProjectsBody
    if (!body.jobDescription) throw new Error('missing jobDescription')
  } catch {
    return Response.json({ error: 'Invalid body — jobDescription required' }, { status: 400 })
  }

  const maxProjects = Math.min(body.maxProjects ?? 3, 5)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, description, detailed_description, tech_stack, role, impact, highlights')
    .eq('user_id', auth.userId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    return Response.json({ error: 'Could not fetch project catalog' }, { status: 500 })
  }

  if (!projects || projects.length === 0) {
    return Response.json({ error: 'No active projects in catalog. Run the seed script first.' }, { status: 404 })
  }

  const projectList = (projects as ProjectRow[]).map((p) => {
    const stack = p.tech_stack?.join(', ') ?? 'N/A'
    const desc = p.detailed_description ?? p.description ?? ''
    const impact = p.impact ? `\nImpact: ${p.impact}` : ''
    return `### ${p.name}\nID: ${p.id}\nStack: ${stack}\nRole: ${p.role ?? 'Lead Developer'}\nDescription: ${desc.slice(0, 300)}${impact}`
  }).join('\n\n')

  const prompt = `You are a resume strategist helping a computer science student pick the best projects to highlight for a job application.

## Job to apply for
**Title:** ${body.jobTitle ?? 'Not specified'}
**Company:** ${body.company ?? 'Not specified'}

**Job Description:**
${body.jobDescription.slice(0, 2500)}

## Available projects in catalog
${projectList}

## Task
Select the top ${maxProjects} projects from the catalog that best match this job description. For each:
1. Rank them from most to least relevant (rank 1 = strongest match)
2. Write a 1-sentence "relevance" explaining WHY this project matches the JD
3. Write a 1-sentence "swapReason" — the talking point for swapping this in: what it demonstrates for THIS role

Respond ONLY with a JSON array (no markdown):
[
  {
    "projectId": "<id>",
    "name": "<name>",
    "rank": 1,
    "relevance": "...",
    "swapReason": "..."
  }
]`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')

    let suggestions: ProjectSuggestion[]
    try {
      suggestions = JSON.parse(raw) as ProjectSuggestion[]
      if (!Array.isArray(suggestions)) throw new Error('not an array')
    } catch {
      console.error('[suggest-projects] Bad JSON from Haiku:', raw)
      return Response.json({ error: 'AI returned malformed response' }, { status: 500 })
    }

    return Response.json({ suggestions })
  } catch (err) {
    console.error('[suggest-projects] Anthropic error:', err)
    return Response.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
