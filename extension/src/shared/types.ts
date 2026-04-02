// ─── Profile ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  address: string | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  citizenship_status: string | null
  visa_sponsorship_required: boolean
  willing_to_relocate: boolean
  resume_url: string | null
  skills: string[] | null
  experience_level: string | null
  years_of_experience: number | null
}

export interface WorkHistory {
  company: string
  title: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
  display_order: number
}

export interface Education {
  school: string
  degree: string | null
  field_of_study: string | null
  gpa: number | null
  graduation_year: number | null
}

export interface SavedAnswer {
  question: string
  answer: string
}

export interface StarResponse {
  question: string
  full_response: string | null
}

export interface FullProfile {
  user: UserProfile
  workHistory: WorkHistory[]
  education: Education[]
  savedAnswers: SavedAnswer[]
  starResponses: StarResponse[]
}

// ─── Extension messages ───────────────────────────────────────────────────────

export type AtsType = 'greenhouse' | 'lever' | 'workday' | 'generic' | null

export interface PageInfo {
  ats: AtsType
  jobTitle: string | null
  company: string | null
  jobDescription: string | null
  isJobPage: boolean
}

export interface FilledField {
  label: string
  value: string
  selector: string
}

export interface SkippedField {
  label: string
  reason: string
}

export interface FillResult {
  filled: FilledField[]
  skipped: SkippedField[]
}

// ─── Message protocol (popup ↔ content ↔ background) ─────────────────────────

export type ExtensionMessage =
  | { type: 'GET_PAGE_INFO' }
  | { type: 'PAGE_INFO'; payload: PageInfo }
  | { type: 'FILL_FORM'; payload: FullProfile }
  | { type: 'FILL_RESULT'; payload: FillResult }
  | { type: 'ADD_TO_BACKLOG'; payload: { url: string; title: string; company: string; description: string | null } }
  | { type: 'MARK_APPLIED'; payload: { jobUrl: string; jobTitle: string | null; company: string | null } }
