import { describe, it, expect, beforeEach } from 'vitest'
import { getLabelForInput, isElementFillable, queryShadowAll, computeFills, applyFills } from './fill'
import type { FullProfile, ScannedField } from '../shared/types'

// ─── Minimal profile fixture ──────────────────────────────────────────────────

const PROFILE: FullProfile = {
  user: {
    id: 'u1',
    email: 'kenny@example.com',
    full_name: 'Kenny Nguyen',
    phone: '555-123-4567',
    address: 'San Francisco, CA, 94105',
    linkedin_url: 'https://linkedin.com/in/kenny',
    github_url: 'https://github.com/kenny',
    portfolio_url: 'https://kennydev.com',
    citizenship_status: null,
    visa_sponsorship_required: false,
    willing_to_relocate: false,
    resume_url: 'https://storage.example.com/resume.pdf',
    skills: ['TypeScript', 'React'],
    experience_level: 'mid',
    years_of_experience: 3,
    gender: null,
    race_ethnicity: null,
    hispanic_latino: null,
    veteran_status: null,
    disability_status: null,
    desired_salary: '$120,000',
  },
  workHistory: [],
  education: [{ school: 'UC Berkeley', degree: 'B.S.', field_of_study: 'Computer Science', gpa: 3.8, graduation_year: 2023 }],
  savedAnswers: [],
  starResponses: [],
}

function setBody(html: string) {
  document.body.innerHTML = html
}

// ─── getLabelForInput — regression tests ─────────────────────────────────────

describe('getLabelForInput — label[for] association', () => {
  beforeEach(() => setBody(''))

  it('reads label via for/id association', () => {
    setBody('<label for="fname">First Name</label><input id="fname" type="text" />')
    const input = document.getElementById('fname')!
    expect(getLabelForInput(input)).toBe('first name')
  })

  it('reads aria-labelledby', () => {
    setBody('<span id="lbl">Email Address</span><input type="email" aria-labelledby="lbl" />')
    const input = document.querySelector('input')!
    expect(getLabelForInput(input)).toBe('email address')
  })

  it('reads wrapping label', () => {
    setBody('<label>Phone Number <input type="tel" /></label>')
    const input = document.querySelector('input')!
    expect(getLabelForInput(input)).toContain('phone')
  })

  it('reads aria-label attribute', () => {
    setBody('<input type="text" aria-label="LinkedIn URL" />')
    const input = document.querySelector('input')!
    expect(getLabelForInput(input)).toBe('linkedin url')
  })

  it('falls back to placeholder', () => {
    setBody('<input type="text" placeholder="Enter your email" />')
    const input = document.querySelector('input')!
    expect(getLabelForInput(input)).toContain('email')
  })

  it('falls back to name attribute (spaces from underscores)', () => {
    setBody('<input type="text" name="first_name" />')
    const input = document.querySelector('input')!
    expect(getLabelForInput(input)).toBe('first name')
  })

  it('returns empty string for input with no identifiers', () => {
    setBody('<input type="text" />')
    const input = document.querySelector('input')!
    expect(getLabelForInput(input)).toBe('')
  })
})

// ─── isElementFillable — visibility filter ────────────────────────────────────

describe('isElementFillable', () => {
  beforeEach(() => setBody(''))

  it('returns true for a normal visible input', () => {
    setBody('<input type="text" id="x" />')
    const el = document.getElementById('x') as HTMLInputElement
    // jsdom getBoundingClientRect returns 0,0 for all elements — stub it
    el.getBoundingClientRect = () => ({ width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100, x: 0, y: 0, toJSON: () => {} })
    expect(isElementFillable(el)).toBe(true)
  })

  it('returns false for disabled input', () => {
    setBody('<input type="text" disabled />')
    const el = document.querySelector('input') as HTMLInputElement
    el.getBoundingClientRect = () => ({ width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100, x: 0, y: 0, toJSON: () => {} })
    expect(isElementFillable(el)).toBe(false)
  })

  it('returns false for aria-hidden input', () => {
    setBody('<input type="text" aria-hidden="true" />')
    const el = document.querySelector('input') as HTMLInputElement
    el.getBoundingClientRect = () => ({ width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100, x: 0, y: 0, toJSON: () => {} })
    expect(isElementFillable(el)).toBe(false)
  })

  it('returns false for zero-size input (jsdom default)', () => {
    setBody('<input type="text" />')
    const el = document.querySelector('input') as HTMLInputElement
    // Default jsdom getBoundingClientRect returns all zeros
    expect(isElementFillable(el)).toBe(false)
  })
})

// ─── queryShadowAll — shadow DOM traversal ────────────────────────────────────

describe('queryShadowAll', () => {
  beforeEach(() => setBody(''))

  it('finds inputs in normal DOM (no shadow root)', () => {
    setBody('<form><input type="email" id="e" /><input type="text" id="n" /></form>')
    const results = queryShadowAll<HTMLInputElement>('input')
    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results.some((el) => el.id === 'e')).toBe(true)
    expect(results.some((el) => el.id === 'n')).toBe(true)
  })

  it('finds inputs nested inside a shadow root', () => {
    setBody('<div id="host"></div>')
    const host = document.getElementById('host')!
    const shadow = host.attachShadow({ mode: 'open' })
    const input = document.createElement('input')
    input.type = 'text'
    input.id = 'shadow-input'
    shadow.appendChild(input)

    const results = queryShadowAll<HTMLInputElement>('input[type="text"]')
    expect(results.some((el) => el.id === 'shadow-input')).toBe(true)
  })

  it('finds inputs in doubly nested shadow roots', () => {
    setBody('<div id="outer-host"></div>')
    const outer = document.getElementById('outer-host')!
    const outerShadow = outer.attachShadow({ mode: 'open' })

    const innerHost = document.createElement('div')
    innerHost.id = 'inner-host'
    outerShadow.appendChild(innerHost)
    const innerShadow = innerHost.attachShadow({ mode: 'open' })

    const input = document.createElement('input')
    input.type = 'text'
    input.id = 'deep-input'
    innerShadow.appendChild(input)

    const results = queryShadowAll<HTMLInputElement>('input[type="text"]')
    expect(results.some((el) => el.id === 'deep-input')).toBe(true)
  })

  it('does not include duplicates when called from document', () => {
    setBody('<form><input type="text" id="a" /></form>')
    const results = queryShadowAll<HTMLInputElement>('input')
    const ids = results.map((el) => el.id)
    const unique = new Set(ids)
    expect(ids.length).toBe(unique.size)
  })
})

// ─── WORKDAY_AUTOMATION_ID_MAP — field mapping ────────────────────────────────
// These tests verify that computeFills correctly maps Workday automation IDs
// to profile fields by constructing a minimal Workday-like shadow DOM structure.

function makeVisibleInput(automationId: string, type = 'text'): HTMLInputElement {
  const input = document.createElement('input')
  input.type = type
  input.setAttribute('data-automation-id', automationId)
  // Override getBoundingClientRect so isElementFillable passes
  input.getBoundingClientRect = () => ({ width: 200, height: 32, top: 100, left: 100, bottom: 132, right: 300, x: 100, y: 100, toJSON: () => {} })
  return input
}

function buildWorkdayForm(...inputs: HTMLInputElement[]): void {
  const form = document.createElement('form')
  for (const input of inputs) form.appendChild(input)
  document.body.appendChild(form)
}

describe('computeFills — Workday automation-id mapping', () => {
  beforeEach(() => setBody(''))

  it('maps firstName automation-id to profile first name', () => {
    const input = makeVisibleInput('firstName')
    buildWorkdayForm(input)
    const results = computeFills(PROFILE, 'workday')
    const field = results.find((f) => f.source === 'automation-id' && f.value === 'Kenny')
    expect(field).toBeDefined()
    expect(field?.value).toBe('Kenny')
  })

  it('maps legalName_firstName to first name', () => {
    const input = makeVisibleInput('legalName_firstName')
    buildWorkdayForm(input)
    const results = computeFills(PROFILE, 'workday')
    const field = results.find((f) => f.source === 'automation-id')
    expect(field?.value).toBe('Kenny')
  })

  it('maps lastName automation-id to profile last name', () => {
    const input = makeVisibleInput('lastName')
    buildWorkdayForm(input)
    const results = computeFills(PROFILE, 'workday')
    const field = results.find((f) => f.source === 'automation-id' && f.value.includes('Nguyen'))
    expect(field?.value).toBe('Nguyen')
  })

  it('maps email automation-id to profile email', () => {
    const input = makeVisibleInput('email', 'email')
    buildWorkdayForm(input)
    const results = computeFills(PROFILE, 'workday')
    const field = results.find((f) => f.source === 'automation-id')
    expect(field?.value).toBe('kenny@example.com')
  })

  it('maps phone automation-id to profile phone', () => {
    const input = makeVisibleInput('phone', 'tel')
    buildWorkdayForm(input)
    const results = computeFills(PROFILE, 'workday')
    const field = results.find((f) => f.value === '555-123-4567')
    expect(field).toBeDefined()
  })

  it('falls back to label matching when automation-id is not in map', () => {
    const input = makeVisibleInput('unknownField_xyz')
    input.setAttribute('aria-label', 'GitHub URL')
    buildWorkdayForm(input)
    const results = computeFills(PROFILE, 'workday')
    const field = results.find((f) => f.value === 'https://github.com/kenny')
    expect(field).toBeDefined()
    expect(field?.source).toBe('label')
  })

  it('skips inputs with no matching automation-id and no matching label', () => {
    const input = makeVisibleInput('someRandomField')
    buildWorkdayForm(input)
    const results = computeFills(PROFILE, 'workday')
    const field = results.find((f) => {
      const el = f.elRef.deref()
      return el === input
    })
    expect(field).toBeUndefined()
  })
})

// ─── computeFills — generic (non-Workday) ─────────────────────────────────────

describe('computeFills — generic label-based filling', () => {
  beforeEach(() => setBody(''))

  it('fills first name from label text', () => {
    setBody('<label for="fn">First Name</label><input id="fn" type="text" />')
    const input = document.getElementById('fn') as HTMLInputElement
    input.getBoundingClientRect = () => ({ width: 200, height: 32, top: 10, left: 10, bottom: 42, right: 210, x: 10, y: 10, toJSON: () => {} })
    const results = computeFills(PROFILE, 'generic')
    const field = results.find((f) => f.value === 'Kenny')
    expect(field).toBeDefined()
  })

  it('fills email from label text', () => {
    setBody('<label for="em">Email</label><input id="em" type="email" />')
    const input = document.getElementById('em') as HTMLInputElement
    input.getBoundingClientRect = () => ({ width: 200, height: 32, top: 10, left: 10, bottom: 42, right: 210, x: 10, y: 10, toJSON: () => {} })
    const results = computeFills(PROFILE, 'generic')
    const field = results.find((f) => f.value === 'kenny@example.com')
    expect(field).toBeDefined()
  })

  it('skips fields matching SKIP_LABEL_PATTERNS', () => {
    setBody('<label for="ref">Referral Employee Email</label><input id="ref" type="text" />')
    const input = document.getElementById('ref') as HTMLInputElement
    input.getBoundingClientRect = () => ({ width: 200, height: 32, top: 10, left: 10, bottom: 42, right: 210, x: 10, y: 10, toJSON: () => {} })
    const results = computeFills(PROFILE, 'generic')
    const field = results.find((f) => {
      const el = f.elRef.deref()
      return el === input
    })
    expect(field).toBeUndefined()
  })

  it('returns ScannedField with a live WeakRef', () => {
    setBody('<label for="li">LinkedIn</label><input id="li" type="url" />')
    const input = document.getElementById('li') as HTMLInputElement
    input.getBoundingClientRect = () => ({ width: 200, height: 32, top: 10, left: 10, bottom: 42, right: 210, x: 10, y: 10, toJSON: () => {} })
    const results = computeFills(PROFILE, 'generic')
    const field = results.find((f) => f.value.includes('linkedin'))
    expect(field).toBeDefined()
    expect(field?.elRef.deref()).toBe(input)
  })
})

// ─── applyFills — DOM write pass ─────────────────────────────────────────────

describe('applyFills', () => {
  beforeEach(() => setBody(''))

  it('writes value to a live input element', () => {
    setBody('<input type="text" id="fn" />')
    const input = document.getElementById('fn') as HTMLInputElement
    input.getBoundingClientRect = () => ({ width: 200, height: 32, top: 10, left: 10, bottom: 42, right: 210, x: 10, y: 10, toJSON: () => {} })

    const fields: ScannedField[] = [{
      label: 'First Name',
      value: 'Kenny',
      selector: '#fn',
      elRef: new WeakRef(input),
      source: 'label',
    }]

    const filled = applyFills(fields)
    expect(filled).toHaveLength(1)
    expect(input.value).toBe('Kenny')
    expect(filled[0].value).toBe('Kenny')
  })

  it('skips a field when the element was unmounted (WeakRef returns undefined)', () => {
    // Simulate a dead WeakRef by creating a ScannedField with a WeakRef to
    // an element that we then remove from the DOM (GC may not collect immediately,
    // but we can test the deref path by replacing the DOM entirely)
    setBody('<input type="text" id="gone" />')
    const input = document.getElementById('gone') as HTMLInputElement
    const ref = new WeakRef(input)

    // Remove the element and clear the DOM
    setBody('')

    const fields: ScannedField[] = [{
      label: 'Gone Field',
      value: 'Some Value',
      selector: '#gone',
      elRef: ref,
      source: 'label',
    }]

    // After setBody(''), the element still exists in memory (WeakRef alive).
    // We can't force GC in tests, so instead verify that when deref() works
    // but the element is detached, the fill still runs (no crash).
    // This test primarily validates no exception is thrown.
    expect(() => applyFills(fields)).not.toThrow()
  })

  it('does not overwrite an input that already has a value', () => {
    setBody('<input type="text" id="pre" />')
    const input = document.getElementById('pre') as HTMLInputElement
    input.value = 'already filled'
    input.getBoundingClientRect = () => ({ width: 200, height: 32, top: 10, left: 10, bottom: 42, right: 210, x: 10, y: 10, toJSON: () => {} })

    const fields: ScannedField[] = [{
      label: 'Field',
      value: 'new value',
      selector: '#pre',
      elRef: new WeakRef(input),
      source: 'label',
    }]

    const filled = applyFills(fields)
    expect(filled).toHaveLength(0)
    expect(input.value).toBe('already filled')
  })

  it('returns FilledField[] with correct labels and values', () => {
    setBody('<input type="email" id="em" />')
    const input = document.getElementById('em') as HTMLInputElement
    input.getBoundingClientRect = () => ({ width: 200, height: 32, top: 10, left: 10, bottom: 42, right: 210, x: 10, y: 10, toJSON: () => {} })

    const fields: ScannedField[] = [{
      label: 'email',
      value: 'kenny@example.com',
      selector: '#em',
      elRef: new WeakRef(input),
      source: 'automation-id',
    }]

    const filled = applyFills(fields)
    expect(filled[0].label).toBe('email')
    expect(filled[0].value).toBe('kenny@example.com')
    expect(filled[0].selector).toBe('#em')
  })
})

// ─── getLabelForInput — shadow DOM boundary crossing ─────────────────────────

describe('getLabelForInput — shadow DOM boundary crossing', () => {
  beforeEach(() => setBody(''))

  it('finds a label in the host element scope when input is inside shadow root', () => {
    // Simulate: <div id="field-host"> <label>First Name</label> <div id="inner-host" /> </div>
    // where inner-host has a shadow root containing the actual input
    setBody('<div id="field-host"><label>First Name</label><div id="inner-host"></div></div>')
    const innerHost = document.getElementById('inner-host')!
    const shadow = innerHost.attachShadow({ mode: 'open' })
    const input = document.createElement('input')
    input.type = 'text'
    shadow.appendChild(input)

    const label = getLabelForInput(input)
    // Should find "First Name" from the shadow host's parent scope
    expect(label.toLowerCase()).toContain('first name')
  })

  it('does not grab unrelated long section headings as labels', () => {
    // A section heading that is too long should not be used as the label
    setBody('<div><h2>About Your Work Experience (Please fill in all fields below)</h2><div id="host"></div></div>')
    const host = document.getElementById('host')!
    const shadow = host.attachShadow({ mode: 'open' })
    const input = document.createElement('input')
    input.type = 'text'
    shadow.appendChild(input)

    const label = getLabelForInput(input)
    // The heading is >80 chars so it should not be returned
    expect(label.length).toBe(0)
  })
})
