import type { ApplicationWithJob, CompanyProfile, Job, StarResponse, TimelineEntry } from '@/lib/jobs/types'
import type { InterviewGuide } from '@/lib/llm/question-generator'

const now = '2026-05-20T16:00:00.000Z'

export const e2eCompany: CompanyProfile = {
  id: 'e2e-company-1',
  name: 'Acme Robotics',
  description: 'Acme Robotics builds warehouse automation software for high-throughput fulfillment teams.',
  mission: 'Make every operations team faster, safer, and more precise.',
  notable_products: ['Fleet OS', 'Picker Assist', 'Warehouse Twin'],
  website_url: 'https://example.com',
  headcount_range: '201-500',
  funding_stage: 'Series B',
  tech_stack: ['TypeScript', 'React', 'Postgres', 'Python'],
  enriched_at: now,
}

export const e2eJobs: Job[] = [
  {
    id: 'e2e-job-1',
    title: 'Frontend Platform Engineer',
    company: e2eCompany.name,
    company_id: e2eCompany.id,
    location: 'Remote, United States',
    country: 'United States',
    salary_min: 145000,
    salary_max: 185000,
    url: 'https://example.com/jobs/frontend-platform-engineer',
    source: 'manual',
    posted_at: now,
    fetched_at: now,
    description: 'Build shared React systems for operations dashboards and workflow automation.',
    tags: ['React', 'TypeScript', 'Design Systems'],
    is_remote: true,
    experience_level: 'senior',
    role_type: 'full_time',
    company_profiles: e2eCompany,
    applications: [{ id: 'e2e-app-1', status: 'saved' }],
  },
  {
    id: 'e2e-job-2',
    title: 'Backend Integrations Engineer',
    company: 'Northstar Labs',
    company_id: 'e2e-company-2',
    location: 'New York, NY',
    country: 'United States',
    salary_min: 130000,
    salary_max: 170000,
    url: 'https://example.com/jobs/backend-integrations-engineer',
    source: 'manual',
    posted_at: '2026-05-19T18:30:00.000Z',
    fetched_at: '2026-05-19T18:30:00.000Z',
    description: 'Own ingestion APIs and third-party integrations for enterprise customers.',
    tags: ['Node.js', 'Postgres', 'APIs'],
    is_remote: false,
    experience_level: 'mid',
    role_type: 'full_time',
    company_profiles: null,
    applications: null,
  },
]

export const e2eApplications: ApplicationWithJob[] = [
  {
    id: 'e2e-app-1',
    user_id: 'e2e-user-1',
    job_id: 'e2e-job-1',
    status: 'saved',
    is_archived: false,
    applied_at: null,
    last_updated: now,
    notes: null,
    recruiter_name: 'Maya Chen',
    recruiter_email: 'maya@example.com',
    ats_platform: null,
    jobs: {
      id: 'e2e-job-1',
      title: 'Frontend Platform Engineer',
      company: e2eCompany.name,
      location: 'Remote, United States',
      salary_min: 145000,
      salary_max: 185000,
      url: 'https://example.com/jobs/frontend-platform-engineer',
      is_remote: true,
      tags: ['React', 'TypeScript', 'Design Systems'],
      fetched_at: now,
    },
  },
  {
    id: 'e2e-app-2',
    user_id: 'e2e-user-1',
    job_id: 'e2e-job-2',
    status: 'applied',
    is_archived: false,
    applied_at: '2026-05-18T09:00:00.000Z',
    last_updated: '2026-05-18T09:00:00.000Z',
    notes: null,
    recruiter_name: null,
    recruiter_email: null,
    ats_platform: null,
    jobs: {
      id: 'e2e-job-2',
      title: 'Backend Integrations Engineer',
      company: 'Northstar Labs',
      location: 'New York, NY',
      salary_min: 130000,
      salary_max: 170000,
      url: 'https://example.com/jobs/backend-integrations-engineer',
      is_remote: false,
      tags: ['Node.js', 'Postgres', 'APIs'],
      fetched_at: '2026-05-18T08:00:00.000Z',
    },
  },
  {
    id: 'e2e-app-3',
    user_id: 'e2e-user-1',
    job_id: 'e2e-job-3',
    status: 'technical',
    is_archived: false,
    applied_at: '2026-05-16T12:00:00.000Z',
    last_updated: '2026-05-19T12:00:00.000Z',
    notes: null,
    recruiter_name: null,
    recruiter_email: null,
    ats_platform: null,
    jobs: {
      id: 'e2e-job-3',
      title: 'Product Infrastructure Engineer',
      company: 'Orbit Works',
      location: 'Austin, TX',
      salary_min: 150000,
      salary_max: 190000,
      url: 'https://example.com/jobs/product-infra',
      is_remote: false,
      tags: ['React', 'Infrastructure'],
      fetched_at: '2026-05-19T08:00:00.000Z',
    },
  },
]

export const e2eTimeline: TimelineEntry[] = [
  {
    id: 'e2e-timeline-1',
    application_id: 'e2e-app-1',
    from_status: null,
    to_status: 'saved',
    changed_at: '2026-05-17T09:00:00.000Z',
    note: null,
  },
]

export const e2eGuide: InterviewGuide = {
  overview: 'Acme Robotics uses a practical engineering loop: recruiter screen, UI systems interview, product architecture, and a cross-functional values round.',
  rounds: [
    { name: 'Recruiter Screen', focus: 'Validate role fit, scope, and logistics.' },
    { name: 'Technical Deep Dive', focus: 'Discuss component architecture and API boundaries.' },
    { name: 'Product Collaboration', focus: 'Reason through tradeoffs with design and operations partners.' },
  ],
  behavioral_questions: [
    {
      question: 'Tell me about a time you improved a shared frontend system without slowing product delivery.',
      hint: 'Use a STAR example with measurable reliability or velocity impact.',
    },
    {
      question: 'Describe a time you handled ambiguous requirements from operations or customer teams.',
      hint: 'Show how you clarified constraints and shipped an incremental result.',
    },
  ],
  technical_questions: [
    {
      question: 'How would you design a reusable table system for live warehouse telemetry?',
      hint: 'Cover rendering performance, accessibility, and data refresh strategy.',
      topics: ['React', 'Performance', 'Accessibility'],
    },
    {
      question: 'How would you keep frontend state consistent during optimistic workflow updates?',
      hint: 'Discuss rollback, idempotency, and server conflict handling.',
      topics: ['State management', 'APIs'],
    },
  ],
  cultural_signals: {
    values: ['Operational rigor', 'Practical automation', 'Customer empathy'],
    terminology: ['workflow throughput', 'fleet health', 'human-in-the-loop'],
    avoid: ['Speculative rewrites', 'Ignoring floor operator feedback'],
  },
  questions_to_ask: [
    'How do product engineers validate dashboard workflows with warehouse operators?',
    'Which frontend reliability metric matters most to the operations team today?',
  ],
}

export function e2eJobById(id: string) {
  return e2eJobs.find((job) => job.id === id) ?? null
}

export function e2eApplicationById(id: string) {
  return e2eApplications.find((app) => app.id === id) ?? null
}

export function e2eStarResponse(question: string): StarResponse {
  return {
    id: 'e2e-star-1',
    user_id: 'e2e-user-1',
    company_id: e2eCompany.id,
    question,
    situation: 'Our design system had several divergent table implementations across operations tools.',
    task: 'I needed to consolidate the shared behavior while keeping active feature work unblocked.',
    action: 'I introduced a compatible table primitive, migrated one high-traffic view, and documented the API with examples.',
    result: 'The team reduced duplicate table code and shipped follow-up dashboard work with fewer regressions.',
    full_response: 'Situation: Our design system had several divergent table implementations across operations tools.\n\nTask: I needed to consolidate the shared behavior while keeping active feature work unblocked.\n\nAction: I introduced a compatible table primitive, migrated one high-traffic view, and documented the API with examples.\n\nResult: The team reduced duplicate table code and shipped follow-up dashboard work with fewer regressions.',
    created_at: now,
    updated_at: now,
  }
}
