import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface ProjectInput {
  name: string
  description: string | null
  role: string | null
  tech_stack: string[]
  highlights: string[]
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MatchDimensions {
  role_fit: number       // 0-100: title/scope alignment
  tech_stack: number     // 0-100: required skills coverage
  experience: number     // 0-100: seniority/level fit
  compensation: number   // 0-100: salary alignment (50 if unknown)
}

export interface MatchResult {
  score: number
  rationale: string | null
  dimensions: MatchDimensions | null
  mode: 'skills' | 'resume' | 'none'
}

// ─── Skills-only Jaccard (no LLM, no resume) ─────────────────────────────────

function jaccardScore(skills: string[], tags: string[]): number {
  if (!skills.length || !tags.length) return 0
  const a = new Set(skills.map(s => s.toLowerCase()))
  const b = new Set(tags.map(t => t.toLowerCase()))
  const intersection = [...a].filter(x => b.has(x)).length
  const union = new Set([...a, ...b]).size
  return Math.round((intersection / union) * 100)
}

// ─── Main function ─────────────────────────────────────────────────────────────

function serializeProjects(projects: ProjectInput[]): string {
  return projects
    .slice(0, 5)
    .map(p => [
      `Project: ${p.name}${p.tech_stack.length ? ` (${p.tech_stack.slice(0, 6).join(', ')})` : ''}`,
      p.role ? `Role: ${p.role}` : null,
      p.description ?? null,
      p.highlights.length ? p.highlights.map(h => `• ${h}`).join('\n') : null,
    ].filter(Boolean).join('\n'))
    .join('\n\n')
}

export async function computeMatchScore(params: {
  skills: string[] | null
  resumeText: string | null
  projects?: ProjectInput[] | null
  jobTags: string[] | null
  jobDescription: string | null
  jobTitle: string
  company: string
  salaryMin?: number | null
  salaryMax?: number | null
}): Promise<MatchResult> {
  const { skills, resumeText, projects, jobTags, jobDescription, jobTitle, company, salaryMin, salaryMax } = params

  const hasSkills = skills && skills.length > 0
  const hasResume = resumeText && resumeText.length > 50

  if (!hasSkills && !hasResume) {
    return { score: 0, rationale: null, dimensions: null, mode: 'none' }
  }

  // Full resume mode — GPT-4o-mini with dimension breakdown
  if (hasResume) {
    const salaryContext = salaryMin || salaryMax
      ? `Salary: $${salaryMin ?? '?'}–$${salaryMax ?? '?'}`
      : 'Salary: not listed'

    const jobContext = [
      `Job: ${jobTitle} at ${company}`,
      jobTags?.length ? `Required skills: ${jobTags.join(', ')}` : '',
      salaryContext,
      jobDescription ? `Description (truncated): ${jobDescription.slice(0, 1500)}` : '',
    ].filter(Boolean).join('\n')

    const resumeContext = resumeText!.slice(0, 3000)
    const projectsContext = projects?.length
      ? `\n\nCANDIDATE'S PROJECTS:\n${serializeProjects(projects)}`
      : ''

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-5-nano',
        temperature: 0,
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content: `You are a recruiting assistant. Evaluate how well a resume matches a job posting across 4 dimensions. Consider both work experience and personal projects when scoring tech_stack and role_fit.

Return a JSON object with these fields:
- "score": integer 0-100, weighted average of the 4 dimensions
- "rationale": one sentence max 15 words explaining the overall score
- "dimensions": object with:
  - "role_fit": 0-100 — does the candidate's background align with this role's scope and title?
  - "tech_stack": 0-100 — what fraction of required skills does the candidate have?
  - "experience": 0-100 — does the candidate's seniority match the role's expectations?
  - "compensation": 0-100 — does the listed salary match the candidate's likely range? Use 50 if salary is not listed.

Output only valid JSON, nothing else.`,
          },
          {
            role: 'user',
            content: `RESUME:\n${resumeContext}${projectsContext}\n\nJOB:\n${jobContext}`,
          },
        ],
      })

      const raw = response.choices[0]?.message?.content?.trim() ?? ''
      const parsed = JSON.parse(raw) as {
        score?: number
        rationale?: string
        dimensions?: Partial<MatchDimensions>
      }

      const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 0
      const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : null

      let dimensions: MatchDimensions | null = null
      if (parsed.dimensions && typeof parsed.dimensions === 'object') {
        const d = parsed.dimensions
        dimensions = {
          role_fit: clamp(d.role_fit),
          tech_stack: clamp(d.tech_stack),
          experience: clamp(d.experience),
          compensation: clamp(d.compensation ?? 50),
        }
      }

      return { score, rationale, dimensions, mode: 'resume' }
    } catch {
      // Fall through to skills-only
    }
  }

  // Skills-only mode (no resume uploaded)
  const score = jaccardScore(skills ?? [], jobTags ?? [])
  return { score, rationale: null, dimensions: null, mode: 'skills' }
}

function clamp(val: unknown, fallback = 50): number {
  if (typeof val !== 'number' || isNaN(val)) return fallback
  return Math.max(0, Math.min(100, Math.round(val)))
}
