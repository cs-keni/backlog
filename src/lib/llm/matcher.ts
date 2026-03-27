import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Skills-only Jaccard similarity — no LLM, available without resume
function jaccardScore(skills: string[], tags: string[]): number {
  if (!skills.length || !tags.length) return 0
  const a = new Set(skills.map(s => s.toLowerCase()))
  const b = new Set(tags.map(t => t.toLowerCase()))
  const intersection = [...a].filter(x => b.has(x)).length
  const union = new Set([...a, ...b]).size
  return Math.round((intersection / union) * 100)
}

export interface MatchResult {
  score: number
  rationale: string | null
  mode: 'skills' | 'resume' | 'none'
}

export async function computeMatchScore(params: {
  skills: string[] | null
  resumeText: string | null
  jobTags: string[] | null
  jobDescription: string | null
  jobTitle: string
  company: string
}): Promise<MatchResult> {
  const { skills, resumeText, jobTags, jobDescription, jobTitle, company } = params

  const hasSkills = skills && skills.length > 0
  const hasResume = resumeText && resumeText.length > 50

  if (!hasSkills && !hasResume) {
    return { score: 0, rationale: null, mode: 'none' }
  }

  // Full resume mode — GPT-4o-mini
  if (hasResume) {
    const jobContext = [
      `Job: ${jobTitle} at ${company}`,
      jobTags?.length ? `Required skills: ${jobTags.join(', ')}` : '',
      jobDescription ? `Description (truncated): ${jobDescription.slice(0, 1500)}` : '',
    ].filter(Boolean).join('\n')

    const resumeContext = resumeText!.slice(0, 3000)

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content:
              'You are a recruiting assistant. Given a resume and job posting, output a JSON object with two fields: "score" (integer 0-100, how well the candidate matches) and "rationale" (one sentence, max 15 words, explaining the score). Output only valid JSON, nothing else.',
          },
          {
            role: 'user',
            content: `RESUME:\n${resumeContext}\n\nJOB:\n${jobContext}`,
          },
        ],
      })

      const raw = response.choices[0]?.message?.content?.trim() ?? ''
      const parsed = JSON.parse(raw) as { score?: number; rationale?: string }
      const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 0
      const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : null
      return { score, rationale, mode: 'resume' }
    } catch {
      // Fall back to skills-only on LLM failure
    }
  }

  // Skills-only mode
  const score = jaccardScore(skills ?? [], jobTags ?? [])
  return { score, rationale: null, mode: 'skills' }
}
