export interface CompanyProfile {
  id: string
  name: string
  description: string | null
  headcount_range: string | null
  funding_stage: string | null
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
  url: string
  is_remote: boolean
  tags: string[] | null
}

export interface ApplicationWithJob {
  id: string
  user_id: string
  job_id: string
  status: ApplicationStatus
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
