export interface KeywordGaps {
  skills: string[]
  tools: string[]
  verbs: string[]
}

export function buildKeywordGapPrompt(resumeText: string, jobDescription: string): string {
  return `You are an ATS keyword analyst.

Compare the resume and job description below. Return a JSON object listing keywords present in the job description but absent from the resume, grouped by category.

Resume:
${resumeText.slice(0, 3000)}

Job Description:
${jobDescription.slice(0, 2000)}

Return ONLY valid JSON in this exact shape (no markdown, no explanation):
{
  "skills": ["skill1", "skill2"],
  "tools": ["tool1", "tool2"],
  "verbs": ["verb1", "verb2"]
}

Rules:
- skills: technical competencies (languages, frameworks, methodologies)
- tools: named products or platforms
- verbs: action verbs the JD emphasizes that are absent from the resume
- Only include terms that appear in the JD but NOT in the resume
- Omit generic words ("experience", "team", "strong")
- Return at most 8 items per category
- If a category has no gaps, return an empty array`
}

export function normalizeKeywordGaps(value: unknown): KeywordGaps {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const normalize = (items: unknown) => Array.isArray(items)
    ? items.filter((item): item is string => typeof item === 'string').slice(0, 8)
    : []
  return {
    skills: normalize(source.skills),
    tools: normalize(source.tools),
    verbs: normalize(source.verbs),
  }
}
