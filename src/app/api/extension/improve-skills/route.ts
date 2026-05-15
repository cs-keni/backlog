import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let currentSkills: string
  let profileSkills: string[]
  let jobDescription: string | null

  try {
    const body = await request.json() as {
      currentSkills?: unknown
      profileSkills?: unknown
      jobDescription?: unknown
    }
    currentSkills = typeof body.currentSkills === 'string' ? body.currentSkills : ''
    profileSkills = Array.isArray(body.profileSkills)
      ? (body.profileSkills as unknown[]).filter((s): s is string => typeof s === 'string')
      : []
    jobDescription = typeof body.jobDescription === 'string' ? body.jobDescription : null
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!profileSkills.length && !currentSkills) {
    return Response.json({ error: 'No skills to improve' }, { status: 400 })
  }

  const client = new Anthropic()

  const prompt = [
    'You are helping a job applicant optimize their skills section for an ATS job application form.',
    '',
    'Return a comma-separated list of skills — concise, specific, no explanations.',
    'Prioritize skills that match the job description. Include the applicant\'s strongest relevant skills.',
    'Remove vague or filler skills. Max 15 skills total.',
    '',
    `Applicant's profile skills: ${profileSkills.join(', ') || 'none listed'}`,
    currentSkills ? `Current skills in the form field: ${currentSkills}` : '',
    jobDescription
      ? `Job description (excerpt):\n${jobDescription.slice(0, 1500)}`
      : '',
    '',
    'Return only the comma-separated skills list. No bullet points, no numbers, no extra text.',
  ].filter(Boolean).join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return Response.json({ error: 'Unexpected AI response' }, { status: 500 })
    }

    return Response.json({ skills: content.text.trim() })
  } catch (err) {
    console.error('[improve-skills] error:', err)
    return Response.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
