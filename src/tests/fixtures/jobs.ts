import type { Job, Application, UserProfile } from '@/lib/jobs/types'

let _seq = 0
const seq = () => String(++_seq)

export function makeJob(overrides: Partial<Job> = {}): Job {
  const id = seq()
  return {
    id,
    title: 'Software Engineer',
    company: 'Acme Corp',
    company_id: null,
    location: 'San Francisco, CA',
    country: 'United States',
    salary_min: 120000,
    salary_max: 160000,
    url: `https://boards.greenhouse.io/acme/jobs/${id}`,
    source: 'github',
    posted_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    description: 'Build great software.',
    tags: ['typescript', 'react'],
    is_remote: false,
    experience_level: 'entry',
    role_type: 'full_time',
    company_profiles: null,
    applications: null,
    ...overrides,
  }
}

export function makeApplication(overrides: Partial<Application & { user_id: string; job_id: string; status: string }> = {}): Application & { user_id: string; job_id: string; status: string } {
  return {
    id: seq(),
    user_id: 'user-1',
    job_id: seq(),
    status: 'saved',
    ...overrides,
  }
}

export function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: seq(),
    email: 'test@example.com',
    full_name: 'Test User',
    phone: '5555551234',
    address: 'San Francisco, CA',
    linkedin_url: 'https://linkedin.com/in/testuser',
    github_url: 'https://github.com/testuser',
    portfolio_url: null,
    citizenship_status: 'us_citizen',
    visa_sponsorship_required: false,
    willing_to_relocate: false,
    resume_text: null,
    resume_url: null,
    preferred_locations: ['San Francisco, CA', 'Remote'],
    preferred_salary_min: 100000,
    preferred_role_types: ['full_time'],
    remote_preference: 'any',
    skills: ['TypeScript', 'React', 'Node.js'],
    experience_level: 'entry',
    years_of_experience: 1,
    notification_email: false,
    notification_push: false,
    notification_sms: false,
    notification_quiet_hours_start: null,
    notification_quiet_hours_end: null,
    alert_match_threshold: 50,
    gender: null,
    race_ethnicity: null,
    hispanic_latino: null,
    veteran_status: null,
    disability_status: null,
    desired_salary: null,
    ...overrides,
  }
}
