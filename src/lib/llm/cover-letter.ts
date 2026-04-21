import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ProjectInput {
  name: string
  description: string | null
  role: string | null
  tech_stack: string[]
  highlights: string[]
}

export type CoverLetterTemplate = 'formal' | 'casual' | 'startup'

export interface CoverLetterResult {
  content: string
  template_type: CoverLetterTemplate
}

interface WorkHistoryInput {
  company: string
  title: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
}

const TEMPLATE_GUIDANCE: Record<CoverLetterTemplate, string> = {
  formal: 'Professional and traditional. Use "Dear Hiring Manager," opening, structured paragraphs, formal closing ("Sincerely,"). Best for finance, law, government, or enterprise companies.',
  casual: 'Warm and conversational. First-name basis if possible, enthusiastic but professional, personal anecdotes welcome. Best for mid-size product companies and startups with structured HR.',
  startup: 'Direct and energetic. Skip formal pleasantries, lead with impact, show genuine product enthusiasm, use first person confidently. Best for early-stage startups.',
}

export async function generateCoverLetter(
  resumeText: string,
  workHistory: WorkHistoryInput[],
  jobTitle: string,
  jobCompany: string,
  jobDescription: string,
  skills: string[],
  fullName: string,
  templateOverride?: CoverLetterTemplate,
  projects: ProjectInput[] = [],
): Promise<CoverLetterResult> {
  const workHistoryFormatted = workHistory
    .map(w => `${w.title} at ${w.company} (${w.start_date ?? '?'} – ${w.is_current ? 'Present' : (w.end_date ?? '?')})\n${w.description ?? ''}`)
    .join('\n\n')

  const projectsFormatted = projects.length
    ? '\n\nPROJECTS:\n' + projects.slice(0, 3).map(p => [
        `${p.name}${p.tech_stack.length ? ` (${p.tech_stack.join(', ')})` : ''}`,
        p.role ? `Role: ${p.role}` : null,
        p.description ?? null,
        p.highlights.length ? p.highlights.slice(0, 3).map(h => `• ${h}`).join('\n') : null,
      ].filter(Boolean).join('\n')).join('\n\n')
    : ''

  const templateInstruction = templateOverride
    ? `Use the "${templateOverride}" template style: ${TEMPLATE_GUIDANCE[templateOverride]}`
    : `Auto-select the best template based on the company and job. Choose from:
- "formal": ${TEMPLATE_GUIDANCE.formal}
- "casual": ${TEMPLATE_GUIDANCE.casual}
- "startup": ${TEMPLATE_GUIDANCE.startup}
Pick the one that best fits ${jobCompany} and the role.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [
      {
        role: 'user',
        content: `You are an expert cover letter writer. Write a compelling, personalized cover letter for the following application.

IMPORTANT RULES:
- Never fabricate experience or achievements not present in the resume/work history
- 3–4 tight paragraphs, no filler phrases ("I am writing to apply for…")
- Lead with the strongest hook — a specific achievement, insight, or genuine enthusiasm
- Connect 2-3 specific skills/achievements directly to the job requirements
- Close with a confident, action-oriented paragraph
- Do NOT include date, address headers, or "Enclosure:" — just the letter body
- Sign off with the candidate's full name

CANDIDATE: ${fullName}
SKILLS: ${skills.join(', ')}

TARGET JOB:
Title: ${jobTitle}
Company: ${jobCompany}
Description:
${jobDescription.slice(0, 3000)}

CANDIDATE'S RESUME TEXT:
${resumeText.slice(0, 3000)}

STRUCTURED WORK HISTORY:
${workHistoryFormatted}${projectsFormatted}

TEMPLATE GUIDANCE:
${templateInstruction}

Return a JSON object with exactly this shape:
{
  "template_type": "formal" | "casual" | "startup",
  "content": "full cover letter text here, using \\n for line breaks"
}

Output only valid JSON.`,
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const parsed = JSON.parse(cleaned) as { template_type?: string; content?: string }

  const validTemplates: CoverLetterTemplate[] = ['formal', 'casual', 'startup']
  const template_type: CoverLetterTemplate =
    validTemplates.includes(parsed.template_type as CoverLetterTemplate)
      ? (parsed.template_type as CoverLetterTemplate)
      : 'casual'

  const content = typeof parsed.content === 'string' ? parsed.content : ''

  return { template_type, content }
}
