import Anthropic from '@anthropic-ai/sdk'
import { withRetry } from './retry'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface InterviewKitInput {
  companyName: string
  companyDescription: string | null
  roleTitle: string
  jobDescription: string | null
  fullName: string | null
  currentTitle: string | null
  yearsExperience: number | null
  skills: string[] | null
  starStories: Array<{
    question: string
    situation: string | null
    full_response: string | null
  }>
}

export function buildInterviewKitPrompt(input: InterviewKitInput): string {
  const stories = input.starStories.length
    ? input.starStories
        .slice(0, 5)
        .map(story => {
          const summary = story.situation || story.full_response?.slice(0, 220) || 'No summary available'
          return `${story.question} — ${summary}`
        })
        .join('\n')
    : 'No saved STAR stories yet.'

  return `Company: ${input.companyName}
Company description: ${input.companyDescription ?? 'Not available'}
Role: ${input.roleTitle}
Job description: ${input.jobDescription ? input.jobDescription.slice(0, 2000) : 'Not available'}
My profile: ${input.fullName ?? 'Candidate'}, ${input.currentTitle ?? 'Software Engineer'}, ${input.yearsExperience ?? 'N'} yrs, skills: ${input.skills?.join(', ') ?? 'not specified'}
My top STAR stories:
${stories}

Generate a concise 1-page interview brief with exactly these sections:
1. **Company** (3 bullets: what they do, recent focus, why this role matters)
2. **Likely behavioral questions** (3 questions specific to this role/company)
3. **Your strongest stories** (pick 3 from my STAR list, explain why each fits)
4. **Questions to ask** (2 sharp questions — not generic)
5. **One thing NOT to say** (common mistake for this type of role/company)`
}

export async function generateInterviewKit(input: InterviewKitInput): Promise<string> {
  const prompt = buildInterviewKitPrompt(input)
  const message = await withRetry(() => anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1400,
    messages: [{ role: 'user', content: prompt }],
  }))

  return message.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
    .trim()
}
