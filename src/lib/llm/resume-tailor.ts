import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ProjectInput {
  name: string
  description: string | null
  role: string | null
  tech_stack: string[]
  highlights: string[]
  start_date: string | null
  end_date: string | null
  is_current: boolean
}

export interface TailoredWorkEntry {
  company: string
  title: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  bullets: string[]
}

export interface TailoredResume {
  summary: string
  work_experience: TailoredWorkEntry[]
}

interface WorkHistoryInput {
  company: string
  title: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
}

export async function tailorResume(
  resumeText: string,
  workHistory: WorkHistoryInput[],
  jobTitle: string,
  jobCompany: string,
  jobDescription: string,
  skills: string[],
  projects: ProjectInput[] = [],
): Promise<TailoredResume> {
  const workHistoryFormatted = workHistory
    .map(w => `${w.title} at ${w.company} (${w.start_date ?? '?'} – ${w.is_current ? 'Present' : (w.end_date ?? '?')})\n${w.description ?? ''}`)
    .join('\n\n')

  const projectsFormatted = projects.length
    ? '\n\nPROJECTS:\n' + projects.slice(0, 5).map(p => [
        `${p.name}${p.tech_stack.length ? ` (${p.tech_stack.join(', ')})` : ''}`,
        p.role ? `Role: ${p.role}` : null,
        p.description ?? null,
        p.highlights.length ? p.highlights.map(h => `• ${h}`).join('\n') : null,
      ].filter(Boolean).join('\n')).join('\n\n')
    : ''

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are a professional resume writer. Tailor the candidate's resume for a specific job posting.

IMPORTANT RULES:
- Never fabricate experience, skills, or achievements that aren't in the original resume
- Only reframe, reorder, and sharpen what already exists
- Use strong action verbs and quantify impact where the original implies it
- Each job should have 3-5 bullet points that emphasize relevance to the target role
- Write a 2-3 sentence professional summary that directly addresses the job requirements
- Projects can be referenced in the summary when they demonstrate relevant skills

TARGET JOB:
Title: ${jobTitle}
Company: ${jobCompany}
Description:
${jobDescription.slice(0, 3000)}

CANDIDATE'S CURRENT RESUME TEXT:
${resumeText.slice(0, 4000)}

STRUCTURED WORK HISTORY:
${workHistoryFormatted}${projectsFormatted}

SKILLS: ${skills.join(', ')}

Return a JSON object with exactly this shape:
{
  "summary": "2-3 sentence professional summary tailored to the job",
  "work_experience": [
    {
      "company": "exact company name from work history",
      "title": "exact title from work history",
      "start_date": "YYYY-MM-DD or null",
      "end_date": "YYYY-MM-DD or null",
      "is_current": false,
      "bullets": ["bullet 1", "bullet 2", "bullet 3"]
    }
  ]
}

Include ALL jobs from the structured work history, ordered most-recent first. Output only valid JSON.`,
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const parsed = JSON.parse(cleaned) as {
    summary?: string
    work_experience?: unknown[]
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary : ''

  const work_experience: TailoredWorkEntry[] = Array.isArray(parsed.work_experience)
    ? (parsed.work_experience as unknown[])
        .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .filter(e => typeof e.company === 'string' && typeof e.title === 'string')
        .map(e => ({
          company: e.company as string,
          title: e.title as string,
          start_date: typeof e.start_date === 'string' ? e.start_date : null,
          end_date: typeof e.end_date === 'string' ? e.end_date : null,
          is_current: e.is_current === true,
          bullets: Array.isArray(e.bullets)
            ? (e.bullets as unknown[]).filter((b): b is string => typeof b === 'string')
            : [],
        }))
    : []

  return { summary, work_experience }
}
