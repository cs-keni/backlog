export const maxDuration = 60
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// In-memory rate limit: 5 cover letters per user per day
const dailyLimits = new Map<string, { count: number; date: string }>()

function checkRateLimit(userId: string): boolean {
  const date = new Date().toLocaleDateString('en-CA')
  const entry = dailyLimits.get(userId)
  if (!entry || entry.date !== date) {
    dailyLimits.set(userId, { count: 1, date })
    return true
  }
  if (entry.count >= 5) return false
  entry.count += 1
  return true
}

interface GenerateCoverLetterBody {
  jobTitle:       string
  company:        string
  jobDescription: string
}

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!checkRateLimit(auth.userId)) {
    return Response.json({ error: 'Daily cover letter limit reached (5/day)' }, { status: 429 })
  }

  let body: GenerateCoverLetterBody
  try {
    body = await request.json() as GenerateCoverLetterBody
    if (!body.jobTitle || !body.company || !body.jobDescription) {
      throw new Error('missing required fields')
    }
  } catch {
    return Response.json({ error: 'Invalid body — jobTitle, company, jobDescription required' }, { status: 400 })
  }

  // Fetch user's cover letter style context and profile
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: user }, { data: profile }] = await Promise.all([
    supabase.from('users').select('cover_letter_style_context, full_name').eq('id', auth.userId).single(),
    supabase.from('users').select('full_name, linkedin_url, github_url, portfolio_url').eq('id', auth.userId).single(),
  ])

  const styleContext = user?.cover_letter_style_context ?? null
  const applicantName = profile?.full_name ?? 'the applicant'

  const systemPrompt = `You are a professional cover letter writer who knows ${applicantName}'s voice and style deeply.

Your task: write the BODY of a cover letter (3–4 paragraphs). Do NOT include:
- "Dear [Hiring Manager]" salutation
- "Sincerely, [Name]" closing
- Any header, date, address blocks

The user will paste your output into their own template. Write only the body paragraphs.

Tone and style:
- Confident but not arrogant
- Concrete and specific — use numbers and outcomes where possible
- Show genuine excitement for this company/role
- Avoid generic filler phrases like "I am excited to apply" or "I believe I would be a great fit"
- Match the energy of the job description: formal for enterprise, casual for startups

${styleContext ? `\n## Kenny's writing style (extracted from his past cover letters):\n${styleContext}\n` : ''}`

  const userPrompt = `Write a cover letter body for this job:

**Role:** ${body.jobTitle}
**Company:** ${body.company}

**Job Description:**
${body.jobDescription.slice(0, 3000)}

Requirements:
- 3–4 paragraphs
- Opening: hook that shows you know the company, then pivot to your fit
- Middle: 1–2 specific project/experience stories that match the JD requirements
- Closing: clear expression of interest + brief mention of what you'd bring
- Body text only — no salutation, no sign-off`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    return Response.json({ coverLetterBody: text })
  } catch (err) {
    console.error('[generate-cover-letter] Anthropic error:', err)
    return Response.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
