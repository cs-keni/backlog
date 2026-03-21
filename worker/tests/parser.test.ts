import { describe, it, expect } from 'vitest'
import { parseJobsTable, extractText, extractUrl, cleanLocation } from '../src/github/parser'

const SAMPLE_TABLE = `
# New Grad Positions

Some intro text here.

| Company | Role | Location | Application/Link | Date Posted |
| ------- | ---- | -------- | ---------------- | ----------- |
| [Acme Corp](https://acme.com) | Software Engineer | San Francisco, CA | [Apply](https://boards.greenhouse.io/acme/jobs/123) | Sep 5 |
| ↳ | Backend Engineer | Remote | [Apply](https://boards.greenhouse.io/acme/jobs/456) | Sep 5 |
| ↳ | Frontend Engineer | New York, NY | [Apply](https://boards.greenhouse.io/acme/jobs/789) 🔒 | Aug 2 |
| [Beta Inc](https://beta.com) | Data Engineer | Austin, TX | [Apply](https://jobs.lever.co/beta/abc) | Oct 1 |
| Gamma LLC | ML Engineer | Seattle, WA</br>Remote | <a href="https://gamma.com/jobs/1">Apply</a> | Nov 3 |
| [No Link Corp](https://nolink.com) | SWE | NYC | Not posted yet | Dec 5 |

Some text after the table.
`

describe('parseJobsTable', () => {
  it('parses standard markdown link rows', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const acme = jobs.find((j) => j.title === 'Software Engineer')
    expect(acme).toBeDefined()
    expect(acme!.company).toBe('Acme Corp')
    expect(acme!.url).toBe('https://boards.greenhouse.io/acme/jobs/123')
    expect(acme!.rawDate).toBe('Sep 5')
  })

  it('inherits company name for ↳ rows', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const backend = jobs.find((j) => j.title === 'Backend Engineer')
    expect(backend).toBeDefined()
    expect(backend!.company).toBe('Acme Corp')
  })

  it('skips 🔒 locked rows', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const frontend = jobs.find((j) => j.title === 'Frontend Engineer')
    expect(frontend).toBeUndefined()
  })

  it('parses rows with plain company name (no markdown link)', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const ml = jobs.find((j) => j.title === 'ML Engineer')
    expect(ml).toBeDefined()
    expect(ml!.company).toBe('Gamma LLC')
  })

  it('parses rows with HTML <a> links', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const ml = jobs.find((j) => j.title === 'ML Engineer')
    expect(ml).toBeDefined()
    expect(ml!.url).toBe('https://gamma.com/jobs/1')
  })

  it('skips rows with no parseable URL', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const noLink = jobs.find((j) => j.company === 'No Link Corp')
    expect(noLink).toBeUndefined()
  })

  it('cleans <br> tags from location', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const ml = jobs.find((j) => j.title === 'ML Engineer')
    expect(ml!.location).toBe('Seattle, WA, Remote')
  })

  it('resets lastCompany on a new non-↳ row', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const dataEngineer = jobs.find((j) => j.title === 'Data Engineer')
    expect(dataEngineer!.company).toBe('Beta Inc')
  })
})

describe('extractText', () => {
  it('extracts text from markdown link', () => {
    expect(extractText('[Acme Corp](https://acme.com)')).toBe('Acme Corp')
  })

  it('extracts text from HTML anchor', () => {
    expect(extractText('<a href="https://example.com">Apply</a>')).toBe('Apply')
  })

  it('returns raw string if no link', () => {
    expect(extractText('Plain Text')).toBe('Plain Text')
  })
})

describe('extractUrl', () => {
  it('extracts URL from markdown link', () => {
    expect(extractUrl('[Apply](https://example.com/job/1)')).toBe('https://example.com/job/1')
  })

  it('extracts URL from HTML anchor', () => {
    expect(extractUrl('<a href="https://example.com">Apply</a>')).toBe('https://example.com')
  })

  it('returns null if no URL found', () => {
    expect(extractUrl('Not posted yet')).toBeNull()
  })

  it('handles 🔒 after markdown link', () => {
    expect(extractUrl('[Apply](https://example.com/job/2) 🔒')).toBe('https://example.com/job/2')
  })
})

describe('cleanLocation', () => {
  it('replaces </br> with ", "', () => {
    expect(cleanLocation('Seattle, WA</br>Remote')).toBe('Seattle, WA, Remote')
  })

  it('replaces <br> with ", "', () => {
    expect(cleanLocation('NYC<br>San Francisco, CA')).toBe('NYC, San Francisco, CA')
  })

  it('replaces <br/> with ", "', () => {
    expect(cleanLocation('Austin, TX<br/>Remote')).toBe('Austin, TX, Remote')
  })

  it('decodes &amp;', () => {
    expect(cleanLocation('Boston, MA &amp; Remote')).toBe('Boston, MA & Remote')
  })
})
