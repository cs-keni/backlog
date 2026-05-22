const AI_ENGINEER_KEYWORDS = [
  'ai engineer',
  'ml engineer',
  'machine learning engineer',
  'applied scientist',
  'research engineer',
  'llm engineer',
  'ai software engineer',
  'applied ai',
  'genai',
  'nlp engineer',
]

export function hasAIEngineerApplications(activeJobTitles: string[]): boolean {
  const lowerTitles = activeJobTitles.map((title) => title.toLowerCase())
  return lowerTitles.some((title) =>
    AI_ENGINEER_KEYWORDS.some((keyword) => title.includes(keyword))
  )
}
