import type { WorkHistory, Education, Project, UserProfile } from '@/lib/jobs/types'

let _seq = 0
const seq = () => String(++_seq)

export function makeWorkHistory(overrides: Partial<WorkHistory> = {}): WorkHistory {
  return {
    id: seq(),
    user_id: 'user-1',
    company: 'Startup Inc',
    title: 'Software Engineer',
    start_date: '2023-06-01',
    end_date: null,
    is_current: true,
    description: '• Built features using TypeScript and React\n• Shipped 3 major features',
    display_order: 0,
    ...overrides,
  }
}

export function makeEducation(overrides: Partial<Education> = {}): Education {
  return {
    id: seq(),
    user_id: 'user-1',
    school: 'State University',
    degree: 'Bachelor of Science',
    field_of_study: 'Computer Science',
    gpa: 3.8,
    graduation_year: 2023,
    display_order: 0,
    ...overrides,
  }
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: seq(),
    user_id: 'user-1',
    name: 'Personal Project',
    description: 'A cool app built with TypeScript.',
    role: 'Sole developer',
    tech_stack: ['TypeScript', 'React', 'Supabase'],
    url: 'https://github.com/testuser/project',
    highlights: ['Reduced load time by 40%', 'Shipped MVP in 2 weeks'],
    start_date: '2023-01-01',
    end_date: '2023-03-01',
    is_current: false,
    display_order: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

export function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'test@example.com',
    full_name: 'Test User',
    phone: '5555551234',
    address: 'San Francisco, CA',
    linkedin_url: 'https://linkedin.com/in/testuser',
    github_url: 'https://github.com/testuser',
    portfolio_url: 'https://testuser.dev',
    citizenship_status: 'us_citizen',
    visa_sponsorship_required: false,
    willing_to_relocate: false,
    resume_text: 'Experienced software engineer with 1 year at Startup Inc.',
    resume_url: 'https://storage.example.com/resume.pdf',
    preferred_locations: ['San Francisco, CA', 'Remote'],
    preferred_salary_min: 100000,
    preferred_role_types: ['full_time'],
    remote_preference: 'any',
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
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
    desired_salary: '120000',
    ...overrides,
  }
}
