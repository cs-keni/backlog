import { describe, it, expect, beforeEach } from 'vitest'
import { detectAts, detectNextButton } from './detect'
import { isGenericPostSubmitPage, isPostSubmitConfirmationUrl } from '../shared/postSubmit'

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

describe('post-submit detection helpers', () => {
  it('matches Greenhouse confirmation URLs', () => {
    expect(isPostSubmitConfirmationUrl('https://boards.greenhouse.io/acme/applications/confirmation', 'greenhouse')).toBe(true)
  })

  it('matches Lever confirmation URLs', () => {
    expect(isPostSubmitConfirmationUrl('https://jobs.lever.co/acme/apply/confirmation', 'lever')).toBe(true)
  })

  it('matches Workday applied URLs', () => {
    expect(isPostSubmitConfirmationUrl('https://acme.myworkdayjobs.com/jobs/applied', 'workday')).toBe(true)
  })

  it('does not match generic URLs as known ATS confirmations', () => {
    expect(isPostSubmitConfirmationUrl('https://example.com/thank-you', 'generic')).toBe(false)
  })

  it('never confirms while a form is still present', () => {
    expect(isGenericPostSubmitPage('https://example.com/apply/thank-you', true, 'Thank you for applying!')).toBe(false)
  })

  it('does not confirm a formless page without an explicit confirmation cue', () => {
    // A bare "no form on the new page" used to be treated as "applied" — that
    // fires on virtually any navigation (dashboards, settings pages, login
    // redirects mid-flow), not just genuine confirmation pages.
    expect(isGenericPostSubmitPage('https://example.com/dashboard', false, 'Welcome back')).toBe(false)
    expect(isGenericPostSubmitPage('https://careers.example.com/jobs/login?redirect=App', false, 'Enter your password to continue')).toBe(false)
  })

  it('confirms via a confirmation-style URL', () => {
    expect(isGenericPostSubmitPage('https://example.com/apply/thank-you', false, '')).toBe(true)
    expect(isGenericPostSubmitPage('https://example.com/applications/12/confirmation', false, '')).toBe(true)
  })

  it('confirms via confirmation page text even on a generic URL', () => {
    expect(isGenericPostSubmitPage(
      'https://example.com/apply/done',
      false,
      'Thank you for applying! We have received your application and will be in touch.'
    )).toBe(true)
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

  it('rejects GitHub\'s own settings pages despite "GitHub" appearing in label text', () => {
    // Regression: github.com/settings/* pages were misdetected as job
    // application forms because hasJobForm() bare-matched the word "github"
    // anywhere in any <label>, and GitHub's own UI is full of that word.
    setBody(`
      <form>
        <label>Search GitHub Apps</label><input type="text" name="q" />
        <label>Email</label><input type="email" name="email" />
        <label>Notify me about activity on GitHub</label><input type="text" name="notify" />
        <button type="submit">Save</button>
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

  it('detects a form with brand-name label text in profile context (GitHub Profile URL)', () => {
    // Unlike a bare "github" mention, "GitHub Profile URL" co-occurs with
    // profile/URL wording in the same label — a real application-form signal.
    setBody(`
      <form>
        <label>Full Name</label><input type="text" name="name" />
        <label>Email</label><input type="email" name="email" />
        <label>Phone</label><input type="text" name="phone" />
        <label>GitHub Profile URL</label><input type="text" name="github_profile" />
        <button type="submit">Submit</button>
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

// ─── detectNextButton — light DOM ────────────────────────────────────────────

describe('detectNextButton — light DOM', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  function makeVisible(el: HTMLElement) {
    el.getBoundingClientRect = () => ({
      width: 100, height: 40, top: 10, left: 10,
      bottom: 50, right: 110, x: 10, y: 10, toJSON: () => {},
    })
  }

  it('finds a Next button by text', () => {
    setBody('<button type="button">Next</button>')
    const btn = document.querySelector<HTMLButtonElement>('button')!
    makeVisible(btn)
    expect(detectNextButton()).toBe(btn)
  })

  it('ignores a Back button', () => {
    setBody('<button type="button">Back</button>')
    const btn = document.querySelector<HTMLButtonElement>('button')!
    makeVisible(btn)
    expect(detectNextButton()).toBeNull()
  })
})

// ─── detectNextButton — shadow DOM ────────────────────────────────────────────

describe('detectNextButton — shadow DOM traversal', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('finds a Next button inside a shadow root', () => {
    setBody('<div id="host"></div>')
    const host = document.getElementById('host')!
    const shadow = host.attachShadow({ mode: 'open' })
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = 'Next'
    btn.getBoundingClientRect = () => ({
      width: 100, height: 40, top: 10, left: 10,
      bottom: 50, right: 110, x: 10, y: 10, toJSON: () => {},
    })
    shadow.appendChild(btn)
    expect(detectNextButton()).toBe(btn)
  })

  it('finds a Workday nextButton by data-automation-id in shadow root', () => {
    setBody('<div id="wdhost"></div>')
    const host = document.getElementById('wdhost')!
    const shadow = host.attachShadow({ mode: 'open' })
    const btn = document.createElement('button')
    btn.setAttribute('data-automation-id', 'nextButton')
    btn.textContent = 'Go'
    btn.getBoundingClientRect = () => ({
      width: 100, height: 40, top: 10, left: 10,
      bottom: 50, right: 110, x: 10, y: 10, toJSON: () => {},
    })
    shadow.appendChild(btn)
    expect(detectNextButton()).toBe(btn)
  })
})
