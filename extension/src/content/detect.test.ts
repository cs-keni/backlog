import { describe, it, expect, beforeEach } from 'vitest'
import { detectAts } from './detect'

// hasJobForm is not exported — we test it indirectly through detectAts('') on a generic page
// by checking the full extractPageInfo behavior via the DOM it reads.
// For direct unit testing we import and test detectAts with URL patterns,
// and test hasJobForm behavior by setting up DOM structures.

function setBody(html: string) {
  document.body.innerHTML = html
}

// ─── detectAts URL patterns ───────────────────────────────────────────────────

describe('detectAts — known ATS URL patterns', () => {
  it('identifies Greenhouse boards', () => {
    expect(detectAts('https://boards.greenhouse.io/stripe/jobs/123')).toBe('greenhouse')
  })

  it('identifies Greenhouse by query param', () => {
    expect(detectAts('https://example.com/careers?gh_jid=456')).toBe('greenhouse')
  })

  it('identifies Lever', () => {
    expect(detectAts('https://jobs.lever.co/acme/abc-123')).toBe('lever')
  })

  it('identifies Workday', () => {
    expect(detectAts('https://acme.myworkdayjobs.com/en-US/jobs/job/123')).toBe('workday')
  })

  it('returns null for a random URL', () => {
    expect(detectAts('https://google.com')).toBeNull()
  })

  it('returns null for a streaming site', () => {
    expect(detectAts('https://sflix.to/movie/123')).toBeNull()
  })

  it('returns null for a gaming client URL', () => {
    expect(detectAts('https://authenticate.riotgames.com')).toBeNull()
  })
})

// ─── hasJobForm false-positive regression tests ───────────────────────────────
// These reproduce the exact bug: non-ATS pages with forms being classified as job pages.
// detectAts returns 'generic' when hasJobForm() returns true, so we check for null.

describe('hasJobForm — must NOT false-positive on non-job pages', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('rejects a simple login form (email + password only)', () => {
    setBody(`
      <form>
        <input type="email" name="email" />
        <input type="password" name="password" />
        <input type="text" name="username" />
        <button type="submit">Sign in</button>
      </form>
    `)
    // No file input, no linkedin/github, no job-specific labels → should be null not generic
    expect(detectAts(window.location.href)).toBeNull()
  })

  it('rejects a streaming site search form', () => {
    setBody(`
      <form>
        <input type="text" name="q" placeholder="Search movies..." />
        <input type="email" name="email" placeholder="Your email" />
        <textarea name="comment"></textarea>
        <button type="submit">Search</button>
      </form>
    `)
    expect(detectAts(window.location.href)).toBeNull()
  })

  it('rejects an "Are you still with us?" idle-timeout page', () => {
    setBody(`
      <form>
        <p>Are you still with us?</p>
        <input type="email" name="email" />
        <input type="text" name="name" />
        <input type="text" name="session" />
        <button type="submit">Yes, I'm here</button>
      </form>
    `)
    expect(detectAts(window.location.href)).toBeNull()
  })

  it('rejects a newsletter signup form', () => {
    setBody(`
      <form>
        <input type="text" name="firstName" />
        <input type="text" name="lastName" />
        <input type="email" name="email" />
        <textarea name="message"></textarea>
        <button type="submit">Subscribe</button>
      </form>
    `)
    expect(detectAts(window.location.href)).toBeNull()
  })
})

// ─── hasJobForm true-positive tests ──────────────────────────────────────────

describe('hasJobForm — MUST detect real job application forms', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('detects a form with a resume file upload', () => {
    setBody(`
      <form>
        <input type="text" name="name" />
        <input type="email" name="email" />
        <input type="text" name="phone" />
        <input type="file" name="resume" />
        <button type="submit">Apply</button>
      </form>
    `)
    expect(detectAts(window.location.href)).toBe('generic')
  })

  it('detects a form with a LinkedIn URL field', () => {
    setBody(`
      <form>
        <input type="text" name="name" />
        <input type="email" name="email" />
        <input type="text" name="phone" />
        <input type="text" name="linkedin_url" placeholder="LinkedIn profile URL" />
        <button type="submit">Submit Application</button>
      </form>
    `)
    expect(detectAts(window.location.href)).toBe('generic')
  })

  it('detects a form with a GitHub field', () => {
    setBody(`
      <form>
        <input type="text" name="name" />
        <input type="email" name="email" />
        <input type="text" name="phone" />
        <input type="text" id="github" placeholder="GitHub username" />
        <button type="submit">Apply Now</button>
      </form>
    `)
    expect(detectAts(window.location.href)).toBe('generic')
  })

  it('detects a form with job-application label text (resume)', () => {
    setBody(`
      <form>
        <label>Full Name</label><input type="text" name="name" />
        <label>Email</label><input type="email" name="email" />
        <label>Phone</label><input type="text" name="phone" />
        <label>Resume / CV</label><textarea name="resume_text"></textarea>
        <button type="submit">Submit</button>
      </form>
    `)
    expect(detectAts(window.location.href)).toBe('generic')
  })

  it('detects a form with work authorization label', () => {
    setBody(`
      <form>
        <label>Name</label><input type="text" />
        <label>Email</label><input type="email" />
        <label>Phone</label><input type="text" />
        <label>Work Authorization Status</label><input type="text" />
        <button type="submit">Apply</button>
      </form>
    `)
    expect(detectAts(window.location.href)).toBe('generic')
  })
})
