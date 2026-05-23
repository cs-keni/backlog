export interface PrepQuestion {
  id: string
  topic: string
  difficulty: 'junior' | 'mid' | 'senior'
  prompt: string
  hints: string[]
  concepts: string[]
  companies?: string[]
  rubric?: string[]
}

export interface ConceptPrimer {
  id: string
  title: string
  summary: string
  body: string
  keywords: string[]
}
