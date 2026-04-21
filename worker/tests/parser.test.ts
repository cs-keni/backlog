import { describe, it, expect } from 'vitest'
import { parseJobsTable, extractText, extractUrl, cleanLocation } from '../src/github/parser'

// HTML table format — the current SimplifyJobs README structure
const SAMPLE_TABLE = `
<table>
  <thead>
    <tr><th>Company</th><th>Role</th><th>Location</th><th>Application</th><th>Age</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong><a href="https://acme.com">Acme Corp</a></strong></td>
      <td>Software Engineer</td>
      <td>San Francisco, CA</td>
      <td><div align="center"><a href="https://boards.greenhouse.io/acme/jobs/123"><img alt="Apply"></a></div></td>
      <td>0d</td>
    </tr>
    <tr>
      <td>↳</td>
      <td>Backend Engineer</td>
      <td>Remote</td>
      <td><div align="center"><a href="https://boards.greenhouse.io/acme/jobs/456"><img alt="Apply"></a></div></td>
      <td>1d</td>
    </tr>
    <tr>
      <td>↳</td>
      <td>Frontend Engineer</td>
      <td>New York, NY</td>
      <td><div align="center"><a href="https://boards.greenhouse.io/acme/jobs/789"><img alt="Apply"></a></div> 🔒</td>
      <td>2d</td>
    </tr>
    <tr>
      <td><strong><a href="https://beta.com">Beta Inc</a></strong></td>
      <td>Data Engineer</td>
      <td>Austin, TX</td>
      <td><div align="center"><a href="https://jobs.lever.co/beta/abc"><img alt="Apply"></a></div></td>
      <td>3d</td>
    </tr>
    <tr>
      <td>Gamma LLC</td>
      <td>ML Engineer</td>
      <td>Seattle, WA<br/>Remote</td>
      <td><div align="center"><a href="https://gamma.com/jobs/1"><img alt="Apply"></a></div></td>
      <td>4d</td>
    </tr>
    <tr>
      <td>No Link Corp</td>
      <td>SWE</td>
      <td>NYC</td>
      <td>Not posted yet</td>
      <td>5d</td>
    </tr>
  </tbody>
</table>
`

describe('parseJobsTable', () => {
  it('parses standard HTML rows', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const acme = jobs.find((j) => j.title === 'Software Engineer')
    expect(acme).toBeDefined()
    expect(acme!.company).toBe('Acme Corp')
    expect(acme!.url).toBe('https://boards.greenhouse.io/acme/jobs/123')
    expect(acme!.rawDate).toBe('0d')
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

  it('parses rows with plain company name (no anchor tag)', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const ml = jobs.find((j) => j.title === 'ML Engineer')
    expect(ml).toBeDefined()
    expect(ml!.company).toBe('Gamma LLC')
  })

  it('extracts href from application link cell', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const ml = jobs.find((j) => j.title === 'ML Engineer')
    expect(ml!.url).toBe('https://gamma.com/jobs/1')
  })

  it('skips rows with no parseable URL', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const noLink = jobs.find((j) => j.company === 'No Link Corp')
    expect(noLink).toBeUndefined()
  })

  it('cleans <br/> tags from location', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const ml = jobs.find((j) => j.title === 'ML Engineer')
    expect(ml!.location).toBe('Seattle, WA, Remote')
  })

  it('resets lastCompany on a new non-↳ row', () => {
    const jobs = parseJobsTable(SAMPLE_TABLE)
    const dataEngineer = jobs.find((j) => j.title === 'Data Engineer')
    expect(dataEngineer!.company).toBe('Beta Inc')
  })

  it('skips orphaned ↳ row with no prior parent row', () => {
    const orphan = `
      <table>
        <tbody>
          <tr><td>↳</td><td>Orphan Role</td><td>Remote</td><td><a href="https://example.com">Apply</a></td><td>0d</td></tr>
        </tbody>
      </table>
    `
    const jobs = parseJobsTable(orphan)
    expect(jobs).toHaveLength(0)
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

  it('strips HTML tags when no anchor present', () => {
    expect(extractText('<strong>Company Name</strong>')).toBe('Company Name')
  })
})

describe('extractUrl', () => {
  it('extracts URL from HTML href', () => {
    expect(extractUrl('<a href="https://example.com/job/1">Apply</a>')).toBe('https://example.com/job/1')
  })

  it('extracts URL from markdown link', () => {
    expect(extractUrl('[Apply](https://example.com/job/1)')).toBe('https://example.com/job/1')
  })

  it('returns null if no URL found', () => {
    expect(extractUrl('Not posted yet')).toBeNull()
  })

  it('prefers href over markdown when both present', () => {
    const cell = '<a href="https://direct.com/job">Apply</a> [also](https://md.com/job)'
    expect(extractUrl(cell)).toBe('https://direct.com/job')
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
