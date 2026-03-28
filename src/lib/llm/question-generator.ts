import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface QuestionBank {
  behavioral_questions: string[]
  technical_questions: string[]
}

interface JobSnippet {
  title: string
  description: string | null
}

export async function generateQuestions(
  companyName: string,
  jobs: JobSnippet[],
): Promise<QuestionBank> {
  const jobsText = jobs
    .slice(0, 5)
    .map((j, i) => `Role ${i + 1}: ${j.title}\n${(j.description ?? '').slice(0, 800)}`)
    .join('\n\n')

  const prompt = `You are a senior technical recruiter helping a candidate prepare for interviews at ${companyName}.

Based on these job postings, generate realistic interview questions the candidate is likely to face.

${jobsText}

Respond with JSON only, no markdown:
{
  "behavioral_questions": [
    "Tell me about a time you...",
    ... 6 questions total
  ],
  "technical_questions": [
    "How would you design...",
    ... 6 questions total
  ]
}

Behavioral questions should use the STAR format prompt style. Technical questions should be specific to the tech stack and roles described — not generic. Avoid duplicate themes.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 800,
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<QuestionBank>
    const filterStrings = (arr: unknown): string[] =>
      Array.isArray(arr) ? arr.filter((q): q is string => typeof q === 'string') : []

    return {
      behavioral_questions: filterStrings(parsed.behavioral_questions).slice(0, 8),
      technical_questions: filterStrings(parsed.technical_questions).slice(0, 8),
    }
  } catch {
    return { behavioral_questions: [], technical_questions: [] }
  }
}
