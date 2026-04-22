export interface CompanyProfile {
  id: string
  name: string
  description: string | null
  mission: string | null
  notable_products: string[] | null
  website_url: string | null
  headcount_range: string | null
  funding_stage: string | null
  tech_stack: string[] | null
  enriched_at: string | null
}

export interface StarResponse {
  id: string
  user_id: string
  company_id: string | null
  question: string
  situation: string | null
  task: string | null
  action: string | null
  result: string | null
  full_response: string | null
  created_at: string
  updated_at: string
}

export interface Application {
  id: string
  status: string
}

export interface Job {
  id: string
  title: string
  company: string
  company_id: string | null
  location: string | null
  country: string | null
  salary_min: number | null
  salary_max: number | null
  url: string
  source: 'github' | 'manual'
  posted_at: string
  fetched_at: string
  description: string | null
  tags: string[] | null
  is_remote: boolean
  experience_level: string | null
  role_type: string | null
  company_profiles: CompanyProfile | null
  applications: Application[] | null
}

export type DateRange = '' | '24h' | '7d' | '30d' | '1y'

export interface FeedFilters {
  location: string
  isRemote: 'all' | 'remote' | 'onsite'
  country: 'all' | 'us' | 'international'
  salaryMin: string
  experienceLevel: string
  roleType: string
  dateRange: DateRange
}

export type SortOption = 'newest' | 'salary'

// ─── Tracker types ────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'phone_screen'
  | 'technical'
  | 'final'
  | 'offer'
  | 'rejected'

export interface ApplicationJob {
  id: string
  title: string
  company: string
  location: string | null
  salary_min: number | null
  salary_max: number | null
  url: string | null
  is_remote: boolean
  tags: string[] | null
}

export interface ApplicationWithJob {
  id: string
  user_id: string
  job_id: string
  status: ApplicationStatus
  is_archived: boolean
  applied_at: string | null
  last_updated: string
  notes: Record<string, unknown> | null
  recruiter_name: string | null
  recruiter_email: string | null
  jobs: ApplicationJob
}

export interface TimelineEntry {
  id: string
  application_id: string
  from_status: ApplicationStatus | null
  to_status: ApplicationStatus
  changed_at: string
  note: string | null
}

// ─── Profile types ────────────────────────────────────────────────────────────

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
  resume_text: string | null
  resume_url: string | null
  preferred_locations: string[] | null
  preferred_salary_min: number | null
  preferred_role_types: string[] | null
  remote_preference: 'remote' | 'hybrid' | 'onsite' | 'any' | null
  skills: string[] | null
  experience_level: string | null
  years_of_experience: number | null
  notification_email: boolean
  notification_push: boolean
  notification_sms: boolean
  notification_quiet_hours_start: string | null
  notification_quiet_hours_end: string | null
  alert_match_threshold: number
  // EEO self-identification & compensation (used by extension auto-fill)
  gender: string | null
  race_ethnicity: string | null
  hispanic_latino: string | null
  veteran_status: string | null
  disability_status: string | null
  desired_salary: string | null
}

export interface WorkHistory {
  id: string
  user_id: string
  company: string
  title: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
  display_order: number
}

export interface Education {
  id: string
  user_id: string
  school: string
  degree: string | null
  field_of_study: string | null
  gpa: number | null
  graduation_year: number | null
  display_order: number
}

export interface SavedAnswer {
  id: string
  user_id: string
  question: string
  answer: string
  created_at: string
}

export interface MatchScore {
  id: string
  user_id: string
  job_id: string
  score: number
  rationale: string | null
  computed_at: string
  is_stale: boolean
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  role: string | null
  tech_stack: string[]
  url: string | null
  highlights: string[]
  start_date: string | null
  end_date: string | null
  is_current: boolean
  display_order: number
  created_at: string
}
