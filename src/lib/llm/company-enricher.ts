import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface EnrichmentResult {
  description: string
  headcount_range: string
  funding_stage: string
  tech_stack: string[]
}

interface JobSnippet {
  title: string
  description: string | null
}

export async function enrichCompany(
  companyName: string,
  jobs: JobSnippet[],
): Promise<EnrichmentResult> {
  const jobsText = jobs
    .slice(0, 5)
    .map((j, i) => `Job ${i + 1}: ${j.title}\n${(j.description ?? '').slice(0, 600)}`)
    .join('\n\n')

  const prompt = `You are analyzing a company based on their job postings. Infer what you can — do not hallucinate specific facts.

Company: ${companyName}

Recent job postings:
${jobsText}

Respond with a JSON object only, no markdown:
{
  "description": "2-3 sentence company overview inferred from the postings",
  "headcount_range": one of "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+",
  "funding_stage": one of "Bootstrapped" | "Pre-seed" | "Seed" | "Series A" | "Series B" | "Series C+" | "Public" | "Unknown",
  "tech_stack": ["array", "of", "technologies", "mentioned", "or", "inferred"]
}

Keep tech_stack to at most 12 items. If a field is genuinely unknowable, use "" for strings and [] for arrays, and "Unknown" for funding_stage.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 400,
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<EnrichmentResult>
    return {
      description: typeof parsed.description === 'string' ? parsed.description : '',
      headcount_range: typeof parsed.headcount_range === 'string' ? parsed.headcount_range : '',
      funding_stage: typeof parsed.funding_stage === 'string' ? parsed.funding_stage : 'Unknown',
      tech_stack: Array.isArray(parsed.tech_stack)
        ? parsed.tech_stack.filter((t): t is string => typeof t === 'string').slice(0, 12)
        : [],
    }
  } catch {
    return { description: '', headcount_range: '', funding_stage: 'Unknown', tech_stack: [] }
  }
}
