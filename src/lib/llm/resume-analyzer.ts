import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const COMMON_QUESTIONS = [
  'Tell me about yourself.',
  'What are your greatest technical strengths?',
  "Describe your most impactful project or achievement.",
  'Why are you looking for a new opportunity?',
  'How do you handle working under pressure or tight deadlines?',
  'What type of work environment do you thrive in?',
  'Where do you see yourself in 3–5 years?',
  'What makes you a strong candidate for this role?',
]

export interface ResumeAnalysis {
  skills: string[]
  qa_pairs: Array<{ question: string; answer: string }>
}

export async function analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
  const truncated = resumeText.slice(0, 6000)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a resume parser and career coach. Given a resume, output a JSON object with exactly two fields:
- "skills": an array of technical skills, tools, languages, and frameworks extracted from the resume. Each skill should be properly capitalized (e.g. "TypeScript", "React", "PostgreSQL"). Max 30 skills. No soft skills.
- "qa_pairs": an array of objects with "question" and "answer" fields. Write a first-person answer for each of the ${COMMON_QUESTIONS.length} questions provided, grounded in the resume content. Answers should be 2–4 sentences, specific, and ready to paste into a job application. Questions: ${JSON.stringify(COMMON_QUESTIONS)}

Output only valid JSON matching this shape: { "skills": string[], "qa_pairs": [{ "question": string, "answer": string }] }`,
      },
      {
        role: 'user',
        content: `RESUME:\n${truncated}`,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? '{}'
  const parsed = JSON.parse(raw) as { skills?: unknown; qa_pairs?: unknown }

  const skills = Array.isArray(parsed.skills)
    ? (parsed.skills as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 30)
    : []

  const qa_pairs = Array.isArray(parsed.qa_pairs)
    ? (parsed.qa_pairs as unknown[]).filter(
        (p): p is { question: string; answer: string } =>
          typeof (p as Record<string, unknown>).question === 'string' &&
          typeof (p as Record<string, unknown>).answer === 'string'
      )
    : []

  return { skills, qa_pairs }
}
