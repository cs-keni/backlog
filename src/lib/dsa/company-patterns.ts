import { PATTERNS } from './neetcode150'

type PatternName = (typeof PATTERNS)[number]

export const COMPANY_PATTERNS: Record<string, PatternName[]> = {
  Google: ['Graphs', '1D Dynamic Programming', '2D Dynamic Programming'],
  Meta: ['Trees', 'Graphs', 'Arrays & Hashing'],
  Amazon: ['Trees', 'Graphs', 'Two Pointers'],
  Microsoft: ['Trees', 'Arrays & Hashing', 'Linked List'],
  Apple: ['Arrays & Hashing', 'Trees', 'Binary Search'],
  Stripe: ['Arrays & Hashing', '1D Dynamic Programming', 'Greedy'],
  Airbnb: ['Trees', 'Graphs', 'Backtracking'],
  Uber: ['Graphs', '1D Dynamic Programming', 'Sliding Window'],
  Lyft: ['Graphs', 'Arrays & Hashing', 'Two Pointers'],
  DoorDash: ['Graphs', '1D Dynamic Programming', 'Arrays & Hashing'],
  Snowflake: ['Arrays & Hashing', 'Sliding Window', 'Binary Search'],
  Databricks: ['Arrays & Hashing', 'Graphs', '1D Dynamic Programming'],
  Coinbase: ['Arrays & Hashing', 'Trees', '1D Dynamic Programming'],
  Robinhood: ['Arrays & Hashing', '1D Dynamic Programming', 'Heap / Priority Queue'],
  Netflix: ['Arrays & Hashing', 'Graphs', 'Trees'],
  LinkedIn: ['Graphs', 'Trees', 'Arrays & Hashing'],
  Salesforce: ['Arrays & Hashing', 'Trees', '1D Dynamic Programming'],
  Adobe: ['Arrays & Hashing', 'Trees', '2D Dynamic Programming'],
  Intuit: ['Arrays & Hashing', 'Trees', 'Sliding Window'],
  Bloomberg: ['Arrays & Hashing', 'Trees', 'Heap / Priority Queue'],
  Pinterest: ['Graphs', 'Trees', 'Backtracking'],
  Atlassian: ['Arrays & Hashing', 'Graphs', 'Greedy'],
  Dropbox: ['Arrays & Hashing', 'Trees', 'Graphs'],
  Palantir: ['Graphs', 'Arrays & Hashing', '2D Dynamic Programming'],
  OpenAI: ['Graphs', '1D Dynamic Programming', 'Arrays & Hashing'],
  Anthropic: ['Graphs', 'Trees', '1D Dynamic Programming'],
  Nvidia: ['Arrays & Hashing', 'Math & Geometry', 'Bit Manipulation'],
  Tesla: ['Arrays & Hashing', 'Graphs', 'Math & Geometry'],
  SpaceX: ['Arrays & Hashing', 'Graphs', 'Math & Geometry'],
  Rippling: ['Arrays & Hashing', 'Trees', 'Greedy'],
}

export function getCompanyPatterns(company: string): PatternName[] | null {
  const normalized = company.toLowerCase()
  const match = Object.entries(COMPANY_PATTERNS).find(([name]) =>
    normalized === name.toLowerCase() || normalized.includes(name.toLowerCase())
  )
  return match?.[1] ?? null
}
