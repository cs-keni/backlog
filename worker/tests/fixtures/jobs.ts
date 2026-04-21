import type { RawJobEntry } from '../../src/github/parser'
import type { NormalizedJob } from '../../src/llm/normalizer'

export function makeRawEntry(overrides: Partial<RawJobEntry> = {}): RawJobEntry {
  return {
    company: 'Acme Corp',
    title: 'Software Engineer',
    location: 'San Francisco, CA',
    url: 'https://boards.greenhouse.io/acme/jobs/123',
    rawDate: '0d',
    ...overrides,
  }
}

export function makeNormalizedJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    title: 'Software Engineer',
    company: 'Acme Corp',
    location: 'San Francisco, CA',
    country: 'United States',
    is_remote: false,
    salary_min: 120000,
    salary_max: 160000,
    experience_level: 'entry',
    tags: ['typescript', 'react', 'node'],
    url: 'https://boards.greenhouse.io/acme/jobs/123',
    posted_at: new Date().toISOString(),
    description: 'Build and ship great software.',
    ...overrides,
  }
}
