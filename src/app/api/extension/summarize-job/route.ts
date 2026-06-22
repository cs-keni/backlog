export const maxDuration = 30
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// In-memory rate limit: 30 summaries per user per day
const dailyLimits = new Map<string, { count: number; date: string }>()

function checkRateLimit(userId: string): boolean {
  const date = new Date().toLocaleDateString('en-CA')
  const entry = dailyLimits.get(userId)
  if (!entry || entry.date !== date) {
    dailyLimits.set(userId, { count: 1, date })
    return true
  }
  if (entry.count >= 30) return false
  entry.count += 1
  return true
}

export interface JobSummary {
  pay:          string | null
  location:     string | null
  requirements: string[]
  techStack:    string[]
  highlights:   string[]
}

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!checkRateLimit(auth.userId)) {
    return Response.json({ error: 'Rate limit reached' }, { status: 429 })
  }

  const body = await request.json().catch(() => null) as {
    jobTitle: string
    company: string
    jobDescription: string
  } | null

  if (!body?.jobDescription) {
    return Response.json({ error: 'jobDescription required' }, { status: 400 })
  }

  const prompt = `Extract structured job info from this description. Return ONLY valid JSON matching this exact schema. Keep all strings SHORT (≤30 chars each — these are UI chips).

Schema:
{
  "pay": string | null,        // e.g. "$120k–$160k" or "Competitive" or null
  "location": string | null,   // e.g. "On-site · NYC" or "Remote" or null
  "requirements": string[],    // max 3 items, e.g. ["2+ yrs Python", "B.S. CS"]
  "techStack": string[],       // max 4 items, e.g. ["React", "Node.js", "AWS"]
  "highlights": string[]       // max 2 items, standout perks/notes, e.g. ["Equity", "Series B"]
}

Job: ${body.jobTitle} at ${body.company}

Description (first 3000 chars):
${body.jobDescription.slice(0, 3000)}

Return only the JSON object, no markdown, no explanation.`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    const summary = JSON.parse(raw) as JobSummary
    return Response.json(summary)
  } catch (err) {
    console.error('[summarize-job] error:', err)
    return Response.json({ error: 'Summarization failed' }, { status: 500 })
  }
}
