import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface StarResult {
  situation: string
  task: string
  action: string
  result: string
  full_response: string
}

interface WorkHistoryEntry {
  company: string
  title: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
}

export async function buildStarResponse(
  question: string,
  fullName: string,
  skills: string[],
  workHistory: WorkHistoryEntry[],
): Promise<StarResult> {
  const workText = workHistory
    .slice(0, 5)
    .map(w => {
      const period = w.is_current ? `${w.start_date ?? ''} – Present` : `${w.start_date ?? ''} – ${w.end_date ?? ''}`
      return `${w.title} at ${w.company} (${period})\n${w.description ?? '(no description)'}`
    })
    .join('\n\n')

  const prompt = `You are helping ${fullName} prepare a STAR-format response for a job interview question.

Question: "${question}"

Their background:
Skills: ${skills.slice(0, 20).join(', ')}

Work history:
${workText}

Write a realistic, specific STAR response they could give. Draw on their actual experience — do not invent companies, roles, or achievements not present above. If their background doesn't directly map, frame a transferable experience.

Respond with JSON only, no markdown:
{
  "situation": "2-3 sentences describing the context and background",
  "task": "1-2 sentences describing their specific responsibility or challenge",
  "action": "3-4 sentences describing concrete steps they took",
  "result": "1-2 sentences describing the outcome with specifics where possible"
}

Write in first person. Keep each section tight — interviewers lose attention quickly.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<StarResult>
    const situation = typeof parsed.situation === 'string' ? parsed.situation : ''
    const task = typeof parsed.task === 'string' ? parsed.task : ''
    const action = typeof parsed.action === 'string' ? parsed.action : ''
    const result = typeof parsed.result === 'string' ? parsed.result : ''

    const full_response = [
      `Situation: ${situation}`,
      `Task: ${task}`,
      `Action: ${action}`,
      `Result: ${result}`,
    ].join('\n\n')

    return { situation, task, action, result, full_response }
  } catch {
    return { situation: '', task: '', action: '', result: '', full_response: '' }
  }
}
