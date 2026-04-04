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
  gender: string | null
  race_ethnicity: string | null
  hispanic_latino: string | null
  veteran_status: string | null
  disability_status: string | null
  desired_salary: string | null
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

// A form field that Tier 1 couldn't fill — sent to Haiku for Tier 2 analysis
export interface UnfilledField {
  selector: string
  label: string
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select'
  options?: string[]
}

export interface FillResult {
  filled: FilledField[]
  skipped: SkippedField[]
  unfilledFields: UnfilledField[]
}

// Haiku's verdict on each unfilled field
export type FieldAnalysisResult =
  | { type: 'value'; selector: string; value: string }
  | { type: 'open_ended'; selector: string; question: string }
  | { type: 'skip'; selector: string }

// Per-page fill state stored in chrome.storage.session keyed by tabId
export interface PageFill {
  url: string
  pageIndex: number
  filled: FilledField[]
}

// Per-tab session state in chrome.storage.session
export interface TabSessionState {
  autoAdvance: boolean
  profile: FullProfile | null
  pages: PageFill[]
  currentPageIndex: number
}

// DETECT_PAGE_TYPE response
export interface PageTypeInfo {
  hasNextButton: boolean
  hasFinalSubmit: boolean
  hasVisibleModal: boolean
  nextButtonText?: string
}

// ─── Message protocol (popup ↔ content ↔ background) ─────────────────────────

export type ExtensionMessage =
  | { type: 'GET_PAGE_INFO' }
  | { type: 'PAGE_INFO'; payload: PageInfo }
  | { type: 'FILL_FORM'; payload: FullProfile }
  | { type: 'FILL_FORM_TIER1'; payload: FullProfile }
  | { type: 'FILL_FORM_TIER2'; payload: { fields: Array<{ selector: string; value: string }> } }
  | { type: 'FILL_RESULT'; payload: FillResult }
  | { type: 'DETECT_PAGE_TYPE' }
  | { type: 'CLICK_NEXT_BUTTON' }
  | { type: 'ADD_TO_BACKLOG'; payload: { url: string; title: string; company: string; description: string | null } }
  | { type: 'MARK_APPLIED'; payload: { jobUrl: string; jobTitle: string | null; company: string | null } }
  | { type: 'PAGE_NAVIGATED'; payload: { url: string } }
