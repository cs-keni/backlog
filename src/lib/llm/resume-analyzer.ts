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

export interface ResumePersonalInfo {
  full_name: string | null
  phone: string | null
  address: string | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
}

export interface ResumeWorkEntry {
  company: string
  title: string
  start_date: string | null  // YYYY-MM-DD
  end_date: string | null    // YYYY-MM-DD
  is_current: boolean
  description: string | null
}

export interface ResumeEducationEntry {
  school: string
  degree: string | null
  field_of_study: string | null
  graduation_year: number | null
  gpa: number | null
}

export interface ResumeAnalysis {
  personal_info: ResumePersonalInfo
  skills: string[]
  work_history: ResumeWorkEntry[]
  education: ResumeEducationEntry[]
  qa_pairs: Array<{ question: string; answer: string }>
}

export async function analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
  const truncated = resumeText.slice(0, 8000)

  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    temperature: 0.2,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a precise resume parser. Given a resume, output a JSON object with exactly these fields:

"personal_info": object with:
  - "full_name": string or null
  - "phone": string or null — digits only, no formatting (e.g. "5035551234")
  - "address": string or null — city and state (e.g. "Portland, OR")
  - "linkedin_url": string or null — full URL (e.g. "https://linkedin.com/in/janedoe")
  - "github_url": string or null — full URL (e.g. "https://github.com/janedoe")
  - "portfolio_url": string or null — personal website or portfolio URL, not LinkedIn/GitHub

"skills": array of technical skills, tools, languages, and frameworks. Properly capitalized (e.g. "TypeScript", "React", "PostgreSQL"). Max 30. No soft skills.

"work_history": array ordered most-recent first. Each entry:
  - "company": string
  - "title": string
  - "start_date": "YYYY-MM-01" or null
  - "end_date": "YYYY-MM-01" or null (null if current)
  - "is_current": boolean
  - "description": string or null — 3–5 bullet points starting with "• " describing responsibilities and impact. Each bullet on its own line. Format: "• Did X using Y, resulting in Z\\n• ..."

"education": array. Each entry:
  - "school": string
  - "degree": string or null (e.g. "Bachelor of Science")
  - "field_of_study": string or null (e.g. "Computer Science")
  - "graduation_year": number or null
  - "gpa": number or null (e.g. 3.85)

"qa_pairs": array with "question" and "answer" fields. Write a first-person answer for each question listed, grounded in the resume. Answers should be 2–4 sentences, specific, ready to paste into a job application. Questions: ${JSON.stringify(COMMON_QUESTIONS)}

Only include data you can extract from the resume. Use null for anything not present. Output only valid JSON.`,
      },
      {
        role: 'user',
        content: `RESUME:\n${truncated}`,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? '{}'
  const parsed = JSON.parse(raw) as Record<string, unknown>

  // personal_info
  const pi = (parsed.personal_info ?? {}) as Record<string, unknown>
  const personal_info: ResumePersonalInfo = {
    full_name: typeof pi.full_name === 'string' ? pi.full_name : null,
    phone: typeof pi.phone === 'string' ? pi.phone.replace(/\D/g, '') : null,
    address: typeof pi.address === 'string' ? pi.address : null,
    linkedin_url: typeof pi.linkedin_url === 'string' ? pi.linkedin_url : null,
    github_url: typeof pi.github_url === 'string' ? pi.github_url : null,
    portfolio_url: typeof pi.portfolio_url === 'string' ? pi.portfolio_url : null,
  }

  // skills
  const skills = Array.isArray(parsed.skills)
    ? (parsed.skills as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 30)
    : []

  // work_history
  const work_history: ResumeWorkEntry[] = Array.isArray(parsed.work_history)
    ? (parsed.work_history as unknown[])
        .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .filter(e => typeof e.company === 'string' && typeof e.title === 'string')
        .map(e => ({
          company: e.company as string,
          title: e.title as string,
          start_date: typeof e.start_date === 'string' ? e.start_date : null,
          end_date: typeof e.end_date === 'string' ? e.end_date : null,
          is_current: e.is_current === true,
          description: typeof e.description === 'string' ? e.description : null,
        }))
    : []

  // education
  const education: ResumeEducationEntry[] = Array.isArray(parsed.education)
    ? (parsed.education as unknown[])
        .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .filter(e => typeof e.school === 'string')
        .map(e => ({
          school: e.school as string,
          degree: typeof e.degree === 'string' ? e.degree : null,
          field_of_study: typeof e.field_of_study === 'string' ? e.field_of_study : null,
          graduation_year: typeof e.graduation_year === 'number' ? e.graduation_year : null,
          gpa: typeof e.gpa === 'number' ? e.gpa : null,
        }))
    : []

  // qa_pairs
  const qa_pairs = Array.isArray(parsed.qa_pairs)
    ? (parsed.qa_pairs as unknown[]).filter(
        (p): p is { question: string; answer: string } =>
          typeof (p as Record<string, unknown>).question === 'string' &&
          typeof (p as Record<string, unknown>).answer === 'string'
      )
    : []

  return { personal_info, skills, work_history, education, qa_pairs }
}
