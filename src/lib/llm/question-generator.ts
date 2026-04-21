import Anthropic from '@anthropic-ai/sdk'
import { withRetry } from './retry'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface InterviewQuestion {
  question: string
  hint: string     // What a strong answer looks like (1-2 sentences)
  topics?: string[] // For technical questions: relevant skill areas
}

export interface InterviewGuide {
  overview: string  // 2-3 sentences on typical process (rounds, format, difficulty)
  rounds: Array<{ name: string; focus: string }> // Known interview rounds
  behavioral_questions: InterviewQuestion[]
  technical_questions: InterviewQuestion[]
  cultural_signals: {
    values: string[]       // Core values the company screens for
    terminology: string[]  // Internal terms / phrases to know
    avoid: string[]        // Anti-patterns interviewers watch for
  }
  questions_to_ask: string[] // Sharp questions to ask interviewers
}

// Legacy shape kept for backward compat — returned when interview_guide is not yet generated
export interface QuestionBank {
  behavioral_questions: string[]
  technical_questions: string[]
}

interface JobSnippet {
  title: string
  description: string | null
}

// ─── Main function ──────────────────────────────────────────────────────────────

export async function generateInterviewGuide(
  companyName: string,
  jobs: JobSnippet[],
): Promise<InterviewGuide> {
  const jobsText = jobs
    .slice(0, 5)
    .map((j, i) => `Role ${i + 1}: ${j.title}\n${(j.description ?? '').slice(0, 800)}`)
    .join('\n\n')

  const prompt = `You are a senior technical recruiter helping a software engineer candidate prepare for interviews at ${companyName}.

Use your knowledge of ${companyName}'s culture, engineering culture, and known interview practices. Draw on job postings below for tech stack and role context. If you don't have reliable knowledge about a specific field, use reasonable inference from the company type and role — never invent stats or fabricate round structures.

Job postings:
${jobsText}

Generate a structured interview guide. Respond with a JSON object only — no markdown, no explanation:

{
  "overview": "2–3 sentences on ${companyName}'s typical software engineering interview process: number of rounds, general format (take-home, live coding, system design, etc.), and difficulty calibration.",
  "rounds": [
    { "name": "Round name (e.g. Phone Screen, Technical, System Design, Hiring Manager)", "focus": "What this round tests — 1 sentence" }
  ],
  "behavioral_questions": [
    {
      "question": "Behavioral question in STAR prompt style",
      "hint": "What a strong answer demonstrates — 1 sentence, specific to ${companyName}'s culture"
    }
  ],
  "technical_questions": [
    {
      "question": "Technical interview question specific to their stack and roles",
      "hint": "What a strong answer covers — 1 sentence",
      "topics": ["skill1", "skill2"]
    }
  ],
  "cultural_signals": {
    "values": ["Up to 5 core values ${companyName} explicitly screens for"],
    "terminology": ["Internal terms, frameworks, or philosophies the company uses (e.g. 'move fast', 'customer obsession')"],
    "avoid": ["Up to 4 anti-patterns or red flags that interviewers at ${companyName} watch for"]
  },
  "questions_to_ask": [
    "Up to 4 sharp, differentiated questions a candidate should ask ${companyName} interviewers — not generic, not questions answered on their website"
  ]
}

Rules:
- behavioral_questions: exactly 6, grounded in ${companyName}'s stated values or known culture
- technical_questions: exactly 6, scoped to the actual tech stack visible in the job postings
- All hints must be specific — avoid generic advice like "show your work"
- questions_to_ask must be genuinely differentiated — questions that signal deep research, not generic curiosity`

  const message = await withRetry(() => anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  }))

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<InterviewGuide>

    const filterQuestions = (arr: unknown): InterviewQuestion[] => {
      if (!Array.isArray(arr)) return []
      return arr
        .filter((q): q is Record<string, unknown> => typeof q === 'object' && q !== null)
        .map(q => ({
          question: typeof q.question === 'string' ? q.question : '',
          hint: typeof q.hint === 'string' ? q.hint : '',
          topics: Array.isArray(q.topics) ? q.topics.map(String) : undefined,
        }))
        .filter(q => q.question.length > 0)
        .slice(0, 8)
    }

    const filterStrings = (arr: unknown, max = 8): string[] =>
      Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string').slice(0, max) : []

    const rounds = Array.isArray(parsed.rounds)
      ? parsed.rounds
          .filter((r): r is NonNullable<typeof r> => typeof r === 'object' && r !== null)
          .map(r => {
            const round = r as Record<string, unknown>
            return {
              name: typeof round.name === 'string' ? round.name : '',
              focus: typeof round.focus === 'string' ? round.focus : '',
            }
          })
          .filter(r => r.name.length > 0)
      : []

    const culturalSignals = parsed.cultural_signals as Record<string, unknown> | undefined

    return {
      overview: typeof parsed.overview === 'string' ? parsed.overview : '',
      rounds,
      behavioral_questions: filterQuestions(parsed.behavioral_questions),
      technical_questions: filterQuestions(parsed.technical_questions),
      cultural_signals: {
        values: filterStrings(culturalSignals?.values, 5),
        terminology: filterStrings(culturalSignals?.terminology, 6),
        avoid: filterStrings(culturalSignals?.avoid, 4),
      },
      questions_to_ask: filterStrings(parsed.questions_to_ask, 4),
    }
  } catch {
    // Return minimal valid structure on parse failure
    return {
      overview: '',
      rounds: [],
      behavioral_questions: [],
      technical_questions: [],
      cultural_signals: { values: [], terminology: [], avoid: [] },
      questions_to_ask: [],
    }
  }
}

// ─── Legacy adapter ─────────────────────────────────────────────────────────────
// Used when company_profiles.interview_guide is not yet populated.
// Kept to avoid breaking existing cached entries during migration rollout.

export async function generateQuestions(
  companyName: string,
  jobs: JobSnippet[],
): Promise<QuestionBank> {
  const guide = await generateInterviewGuide(companyName, jobs)
  return {
    behavioral_questions: guide.behavioral_questions.map(q => q.question),
    technical_questions: guide.technical_questions.map(q => q.question),
  }
}
