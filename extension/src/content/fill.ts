import type { FullProfile, FilledField, SkippedField, FillResult, AtsType, UnfilledField, ScannedField } from '../shared/types'
import { queryShadowAll, queryShadowScoped } from '../shared/domUtils'

// ─── Input value setter ───────────────────────────────────────────────────────
// Works for standard inputs and React/Angular controlled inputs by dispatching
// the native input + change + blur events that frameworks listen to.
// blur is required for ATS platforms (Lever, AshbyHQ) that validate on focus loss.

function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value'
  )?.set
  nativeInputValueSetter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  input.dispatchEvent(new Event('blur', { bubbles: true }))
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const normalized = value.trim().toLowerCase()
  const option =
    // Exact text or value match
    Array.from(select.options).find((o) => o.text.trim() === value || o.value === value) ??
    // Case-insensitive exact
    Array.from(select.options).find((o) => o.text.trim().toLowerCase() === normalized) ??
    // Case-insensitive starts-with (avoids "OR" matching "Oregon")
    Array.from(select.options).find((o) => o.text.trim().toLowerCase().startsWith(normalized)) ??
    // Case-insensitive contains (last resort)
    Array.from(select.options).find((o) => o.text.trim().toLowerCase().includes(normalized) && normalized.length > 2)
  if (option) {
    select.value = option.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    select.dispatchEvent(new Event('blur', { bubbles: true }))
  }
}

// ─── Address parser ───────────────────────────────────────────────────────────
// Handles the two common US formats stored in profile.user.address:
//   "6925 SE 152nd Ave., Portland, OR 97236"  (3-part: street, city, ST ZIP)
//   "Portland, OR 97236"                       (2-part: city, ST ZIP)
// Falls back gracefully when format doesn't match (international addresses, etc.)

interface ParsedAddress {
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
}

export function parseAddress(address: string): ParsedAddress {
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  const parseStateZip = (s: string) => {
    const m = s.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/)
    return m ? { state: m[1], zip: m[2] } : null
  }

  if (parts.length >= 3) {
    // "Street, City, ST ZIP" — the last part may be "ST ZIP" or just "ZIP" after a separate state
    const stateZip = parseStateZip(parts[parts.length - 1])
    if (stateZip) {
      return { street: parts[0], city: parts[1], ...stateZip }
    }
    // "Street, City, State, ZIP" — 4 explicit parts
    if (parts.length >= 4) {
      return { street: parts[0], city: parts[1], state: parts[2], zip: parts[3] }
    }
    return { street: parts[0], city: parts[1], state: parts[2], zip: null }
  }

  if (parts.length === 2) {
    // "City, ST ZIP"
    const stateZip = parseStateZip(parts[1])
    if (stateZip) return { street: null, city: parts[0], ...stateZip }
    return { street: null, city: parts[0], state: parts[1], zip: null }
  }

  return { street: null, city: parts[0] ?? null, state: null, zip: null }
}

// ─── Visibility check ─────────────────────────────────────────────────────────
// Skips hidden, disabled, readonly, or zero-size inputs to avoid filling
// off-step Workday wizard fields that are rendered but not active.

export function isElementFillable(el: HTMLElement): boolean {
  // Bounding rect check
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false
  // Computed style
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  if (parseFloat(style.opacity) === 0) return false
  // aria-hidden
  if (el.getAttribute('aria-hidden') === 'true') return false
  // Disabled / readonly
  const inp = el as HTMLInputElement
  if (inp.disabled || inp.readOnly) return false
  return true
}

// ─── Label extraction ─────────────────────────────────────────────────────────

export function getLabelForInput(input: Element): string {
  // 1. <label for="id">
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`)
    if (label) return label.textContent?.trim().toLowerCase() ?? ''
  }
  // 2. aria-labelledby
  const labelledBy = input.getAttribute('aria-labelledby')
  if (labelledBy) {
    const el = document.getElementById(labelledBy)
    if (el) return el.textContent?.trim().toLowerCase() ?? ''
  }
  // 3. Wrapping <label>
  const parentLabel = input.closest('label')
  if (parentLabel) return parentLabel.textContent?.trim().toLowerCase() ?? ''
  // 4. Previous sibling label
  const prev = input.previousElementSibling
  if (prev?.tagName === 'LABEL') return prev.textContent?.trim().toLowerCase() ?? ''
  // 5. aria-label
  const aria = input.getAttribute('aria-label')
  if (aria) return aria.toLowerCase()
  // 6. Walk up ancestor containers looking for a <label> child.
  //    Greenhouse compliance questions use unlabeled <select> inside a wrapper div
  //    where the <label> is a sibling of the wrapper, not the select itself.
  let ancestor = input.parentElement
  while (ancestor && ancestor !== document.body) {
    // Prefer a direct child label (sibling to input's immediate parent)
    const siblingLabel = ancestor.querySelector(':scope > label, :scope > .label')
    if (siblingLabel) return siblingLabel.textContent?.trim().toLowerCase() ?? ''
    // Stop climbing at form/fieldset boundaries to avoid grabbing unrelated labels
    if (ancestor.tagName === 'FORM' || ancestor.tagName === 'FIELDSET') break
    ancestor = ancestor.parentElement
  }
  // 7. Shadow DOM boundary crossing.
  //    Workday inputs live inside nested shadow roots while their labels are in
  //    the parent shadow scope. Climb via .getRootNode().host up to 3 levels.
  let shadowHops = 0
  let root = input.getRootNode()
  while (root instanceof ShadowRoot && shadowHops < 3) {
    shadowHops++
    const host = root.host
    // Check for a label in the host's immediate parent scope
    if (host.id) {
      const hostRoot = host.getRootNode()
      if (hostRoot instanceof ShadowRoot || hostRoot instanceof Document) {
        const labelForHost = (hostRoot as Document | ShadowRoot).querySelector(`label[for="${host.id}"]`)
        if (labelForHost) return labelForHost.textContent?.trim().toLowerCase() ?? ''
      }
    }
    // Look at siblings of the host or its parent container
    let hostAncestor = host.parentElement
    while (hostAncestor && hostAncestor.tagName !== 'FORM' && hostAncestor.tagName !== 'FIELDSET') {
      const sibLabel = hostAncestor.querySelector(':scope > label, :scope > [class*="label"]')
      if (sibLabel) {
        const txt = sibLabel.textContent?.trim().toLowerCase() ?? ''
        // Guard: only accept if the label text looks like a real field label (has content, not a section heading)
        if (txt.length > 0 && txt.length < 80 && !txt.includes('\n')) return txt
      }
      if (hostAncestor === document.body) break
      hostAncestor = hostAncestor.parentElement
    }
    root = host.getRootNode()
  }
  // 8. placeholder
  const placeholder = (input as HTMLInputElement).placeholder
  if (placeholder) return placeholder.toLowerCase()
  // 9. name attribute
  return (input.getAttribute('name') ?? '').toLowerCase().replace(/[_-]/g, ' ')
}

// ─── Field → profile value mapping ───────────────────────────────────────────

type Resolver = (profile: FullProfile) => string | null
type FieldEntry = { patterns: RegExp; resolve: Resolver; exclude?: RegExp }

const FIELD_MAP: Array<FieldEntry> = [
  { patterns: /first\s*name/, exclude: /preferred.*name|nickname/, resolve: (p) => p.user.full_name?.split(' ')[0] ?? null },
  { patterns: /last\s*name|surname|family\s*name/, resolve: (p) => p.user.full_name?.split(' ').slice(1).join(' ') || null },
  { patterns: /^(full\s*)?name$|your\s*name/, resolve: (p) => p.user.full_name },
  { patterns: /\bemail\b/, resolve: (p) => p.user.email },
  { patterns: /phone|mobile|tel/, exclude: /ext(ension)?/, resolve: (p) => p.user.phone },
  { patterns: /linkedin/, resolve: (p) => p.user.linkedin_url },
  { patterns: /github/, resolve: (p) => p.user.github_url },
  { patterns: /portfolio|personal\s*site|personal\s*website|website|url/, resolve: (p) => p.user.portfolio_url },
  { patterns: /address/, exclude: /line.*2|apt|suite|unit/, resolve: (p) => parseAddress(p.user.address ?? '').street ?? p.user.address },
  // City+State combined must come before individual city/state patterns
  {
    patterns: /\bcity\b.*\bstate\b|\bcity.*province/,
    resolve: (p) => {
      const { city, state } = parseAddress(p.user.address ?? '')
      return city && state ? `${city}, ${state}` : (p.user.address ?? null)
    },
  },
  { patterns: /\bcity\b/, resolve: (p) => parseAddress(p.user.address ?? '').city },
  // Use word boundary so "United States" and "statements" don't match
  { patterns: /\bstate\b|\bprovince\b|\bregion\b/, resolve: (p) => parseAddress(p.user.address ?? '').state },
  { patterns: /zip|postal/, resolve: (p) => parseAddress(p.user.address ?? '').zip },
  { patterns: /country/, resolve: () => 'United States' },
  // Compliance yes/no — these must come before /state/ to avoid false matches on "United States"
  { patterns: /at least 18|18 years of age/, resolve: () => 'Yes' },
  { patterns: /legally authorized|authorized to work/, resolve: () => 'Yes' },
  { patterns: /language requirement|fluent.*english|english.*fluent/, resolve: () => 'Yes' },
  { patterns: /certif|acknowledge|agree to the|i have read/, resolve: () => 'Yes' },
  { patterns: /sponsor|visa|require.*sponsor|need.*sponsor/, resolve: (p) => (p.user.visa_sponsorship_required ? 'Yes' : 'No') },
  { patterns: /relocat/, resolve: (p) => (p.user.willing_to_relocate ? 'Yes' : 'No') },
  { patterns: /experience.*year|years.*experience|how many years/, resolve: (p) => p.user.years_of_experience?.toString() ?? null },
  // Salary
  { patterns: /salary|compensation|pay expectation|desired.*pay/, resolve: (p) => p.user.desired_salary ?? null },
  // "How did you hear" — always answer Other to avoid incorrect referral answers
  { patterns: /how did you hear|where did you (hear|learn|find)|source of (this )?job|referral source/, resolve: () => 'Other' },
  // Education — pull from first education entry
  { patterns: /\bschool\b|university|college|institution/, resolve: (p) => p.education[0]?.school ?? null },
  { patterns: /\bdegree\b|degree type|level of education/, resolve: (p) => p.education[0]?.degree ?? null },
  { patterns: /discipline|field of study|major/, resolve: (p) => p.education[0]?.field_of_study ?? null },
  // EEO self-identification
  { patterns: /\bgender\b|\bsex\b/, resolve: (p) => p.user.gender ?? null },
  { patterns: /hispanic|latino/, resolve: (p) => p.user.hispanic_latino ?? null },
  { patterns: /race|ethnicity/, exclude: /hispanic|latino/, resolve: (p) => p.user.race_ethnicity ?? null },
  { patterns: /veteran/, resolve: (p) => p.user.veteran_status ?? null },
  { patterns: /disability|disabled/, resolve: (p) => p.user.disability_status ?? null },
]

function resolveField(label: string, profile: FullProfile): string | null {
  for (const { patterns, exclude, resolve } of FIELD_MAP) {
    if (patterns.test(label) && !exclude?.test(label)) return resolve(profile)
  }
  return null
}

// ─── Workday data-automation-id map ──────────────────────────────────────────
// Workday assigns stable data-automation-id attributes to form inputs across
// tenants (e.g. acme.myworkdayjobs.com vs stripe.myworkdayjobs.com).
// This map is the primary field identification strategy for Workday.

const WORKDAY_ID_MAP: Array<{ ids: RegExp; resolve: Resolver }> = [
  // Name fields — Workday uses both legalName and preferredName prefixes
  { ids: /^(legalName[_-])?firstName$|^legalNameSection_firstName$/, resolve: (p) => p.user.full_name?.split(' ')[0] ?? null },
  { ids: /^(legalName[_-])?lastName$|^legalNameSection_lastName$/, resolve: (p) => p.user.full_name?.split(' ').slice(1).join(' ') || null },
  // Contact
  { ids: /^email$|^emailAddress$|^workEmail$/, resolve: (p) => p.user.email },
  { ids: /^phone$|^phoneNumber$|^phonePrimary$|^mobilePhone$/, resolve: (p) => p.user.phone },
  // Address — all resolvers use parseAddress() for consistent splitting
  { ids: /^addressLine1$|^addressSection_addressLine1$/, resolve: (p) => parseAddress(p.user.address ?? '').street ?? p.user.address?.split(',')[0]?.trim() ?? null },
  { ids: /^city$|^addressSection_city$/, resolve: (p) => parseAddress(p.user.address ?? '').city },
  { ids: /^postalCode$|^zipCode$|^addressSection_postalCode$/, resolve: (p) => parseAddress(p.user.address ?? '').zip },
  // Online presence
  { ids: /^linkedIn(Url)?$|^linkedInProfile$/, resolve: (p) => p.user.linkedin_url },
  { ids: /^gitHub(Url)?$|^githubProfile$/, resolve: (p) => p.user.github_url },
  { ids: /^portfolioUrl$|^personalSite$|^websiteUrl$/, resolve: (p) => p.user.portfolio_url },
  // Experience
  { ids: /^yearsOfExperience$|^totalExperience$/, resolve: (p) => p.user.years_of_experience?.toString() ?? null },
  { ids: /^desiredSalary$|^expectedSalary$/, resolve: (p) => p.user.desired_salary ?? null },
  // Education (first entry)
  { ids: /^school$|^institution$|^universityName$/, resolve: (p) => p.education[0]?.school ?? null },
  { ids: /^major$|^fieldOfStudy$|^discipline$/, resolve: (p) => p.education[0]?.field_of_study ?? null },
  { ids: /^gpa$|^gradePointAverage$/, resolve: (p) => p.education[0]?.gpa?.toString() ?? null },
]

function resolveWorkdayField(automationId: string, profile: FullProfile): string | null {
  for (const { ids, resolve } of WORKDAY_ID_MAP) {
    if (ids.test(automationId)) return resolve(profile)
  }
  return null
}

// ─── Shadow DOM traversal ─────────────────────────────────────────────────────

// ─── Labels to never auto-fill ────────────────────────────────────────────────
const SKIP_LABEL_PATTERNS = /referr(ed|al)|someone else|employee.*email|recruiter/

// ─── Radio button resolution ──────────────────────────────────────────────────
// Maps question text patterns to Yes/No/profile-based answers.
// Keep separate from FIELD_MAP since radio groups need question-level matching
// rather than field-label matching, and the answer is a click target label.

const RADIO_FIELD_MAP: Array<{ patterns: RegExp; resolve: (profile: FullProfile) => string | null }> = [
  // Employment at the applying company — default No (safe; user reviews before submit)
  { patterns: /previously worked|current.*employ|work.*here|employed.*here|former.*employ/, resolve: () => 'No' },
  // Legal / work authorization
  { patterns: /legally authorized|authorized to work|eligible to work/, resolve: () => 'Yes' },
  { patterns: /require.*sponsor|visa.*sponsor|need.*sponsor|sponsorship.*required/, resolve: (p) => p.user.visa_sponsorship_required ? 'Yes' : 'No' },
  // Age / compliance
  { patterns: /at least 18|18 years|age requirement/, resolve: () => 'Yes' },
  // Relocation
  { patterns: /willing.*relocat|open.*relocat/, resolve: (p) => p.user.willing_to_relocate ? 'Yes' : 'No' },
]

function resolveRadio(question: string, profile: FullProfile): string | null {
  for (const { patterns, resolve } of RADIO_FIELD_MAP) {
    if (patterns.test(question)) return resolve(profile)
  }
  return null
}

// ─── computeFills — read-only scan ───────────────────────────────────────────
// Returns a list of fields that would be filled, without touching the DOM.
// The ScannedField holds a WeakRef to the live element for a stable apply pass.

export function computeFills(profile: FullProfile, ats: AtsType): ScannedField[] {
  const scanned: ScannedField[] = []
  const seen = new Set<Element>()

  const queryInputs = ats === 'workday'
    ? () => queryShadowScoped<HTMLInputElement | HTMLTextAreaElement>(
        'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], textarea'
      )
    : () => Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], textarea'
      ))

  for (const input of queryInputs()) {
    try {
      if (seen.has(input)) continue
      seen.add(input)
      if (!isElementFillable(input)) continue

      let value: string | null = null
      let source: ScannedField['source'] = 'label'

      if (ats === 'workday') {
        // Primary: data-automation-id lookup
        const automationId = input.getAttribute('data-automation-id')
        if (automationId) {
          value = resolveWorkdayField(automationId, profile)
          if (value) source = 'automation-id'
        }
      }

      if (!value) {
        // Fallback: label text matching (all ATS types)
        const label = getLabelForInput(input)
        if (!label) continue
        if (SKIP_LABEL_PATTERNS.test(label)) continue
        value = resolveField(label, profile)
        if (value) source = 'label'
      }

      if (!value) continue

      const selector = input.id ? `#${CSS.escape(input.id)}` : `[name="${input.getAttribute('name')}"]`
      const label = getLabelForInput(input) || input.getAttribute('data-automation-id') || selector

      scanned.push({
        label,
        value,
        selector,
        elRef: new WeakRef(input),
        source,
        kind: 'text',
      })
    } catch { /* skip bad element */ }
  }

  // <select> dropdowns (standard HTML selects only — not Workday custom comboboxes)
  if (ats !== 'workday') {
    const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'))
    for (const select of selects) {
      try {
        if (seen.has(select)) continue
        seen.add(select)
        if (!isElementFillable(select)) continue
        const label = getLabelForInput(select)
        if (!label) continue
        if (SKIP_LABEL_PATTERNS.test(label)) continue
        const value = resolveField(label, profile)
        if (!value) continue
        // Check if the value actually matches an option
        const normalized = value.trim().toLowerCase()
        const matchingOption = Array.from(select.options).find(
          (o) => o.text.trim().toLowerCase() === normalized ||
                 o.text.trim().toLowerCase().startsWith(normalized)
        )
        if (!matchingOption) continue
        const selector = select.id ? `#${CSS.escape(select.id)}` : `[name="${select.getAttribute('name')}"]`
        scanned.push({
          label,
          value: matchingOption.text.trim(),
          selector,
          elRef: new WeakRef(select),
          source: 'label',
          kind: 'select',
        })
      } catch { /* skip */ }
    }
  }

  // ── Radio button groups (Yes/No and compliance questions) ─────────────────
  // Query both native radio inputs and ARIA radio elements (Workday uses both).
  // Group by name attribute, find the question via fieldset/legend, resolve answer.
  {
    const radioInputs = ats === 'workday'
      ? queryShadowScoped<HTMLInputElement>('input[type="radio"]')
      : Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'))

    // Group by [name] attribute to find unique questions
    const groups = new Map<string, HTMLInputElement[]>()
    for (const input of radioInputs) {
      if (!isElementFillable(input)) continue
      const key = input.name || input.getAttribute('data-automation-id') || input.id
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(input)
    }

    for (const [, options] of groups) {
      try {
        // Find the question text from the nearest fieldset legend or ancestor label
        const first = options[0]
        let question = ''
        const fieldset = first.closest('fieldset')
        if (fieldset) {
          question = fieldset.querySelector('legend')?.textContent?.trim().toLowerCase() ?? ''
        }
        if (!question) {
          // Walk up for a label-like ancestor
          let ancestor = first.parentElement
          while (ancestor && ancestor !== document.body) {
            const labelEl = ancestor.querySelector(':scope > label, :scope > [class*="label"], :scope > legend')
            if (labelEl) { question = labelEl.textContent?.trim().toLowerCase() ?? ''; break }
            if (ancestor.tagName === 'FORM' || ancestor.tagName === 'FIELDSET') break
            ancestor = ancestor.parentElement
          }
        }
        if (!question) question = getLabelForInput(first)
        if (!question || SKIP_LABEL_PATTERNS.test(question)) continue

        const answer = resolveRadio(question, profile)
        if (!answer) continue

        // Find the option whose visible label matches the answer (shadow-aware via getLabelForInput)
        const targetOption = options.find((opt) => {
          if (opt.checked) return false // Already selected — do not change
          const label = getLabelForInput(opt) || opt.value.toLowerCase()
          return label === answer.toLowerCase() || label.startsWith(answer.toLowerCase())
        })
        if (!targetOption) continue

        const selector = targetOption.id
          ? `#${CSS.escape(targetOption.id)}`
          : `input[name="${targetOption.name}"][value="${targetOption.value}"]`

        scanned.push({
          label: question,
          value: answer,
          selector,
          elRef: new WeakRef(targetOption),
          source: 'label',
          kind: 'radio',
        })
      } catch { /* skip */ }
    }
  }

  return scanned
}

// ─── applyFills — DOM write pass ─────────────────────────────────────────────
// Takes the output of computeFills and writes to DOM.
// Uses WeakRef to get the live element — skips gracefully if element was unmounted.

function flashFill(el: HTMLElement) {
  el.style.outline = '2px solid #6366f1'
  el.style.transition = 'outline 0.15s ease'
  setTimeout(() => { el.style.outline = ''; el.style.transition = '' }, 700)
}

export function applyFills(fields: ScannedField[]): FilledField[] {
  const filled: FilledField[] = []

  for (const field of fields) {
    try {
      const el = field.elRef.deref()
      if (!el) continue // Element was garbage collected / unmounted

      if (field.kind === 'radio') {
        const radio = el as HTMLInputElement
        if (radio.checked) continue // Already selected — do not change
        radio.click()
        radio.dispatchEvent(new Event('change', { bubbles: true }))
        flashFill(radio)
        filled.push({ label: field.label, value: field.value, selector: field.selector })
      } else if (el instanceof HTMLSelectElement) {
        const before = el.value
        setSelectValue(el, field.value)
        if (el.value !== before && el.value !== '') {
          flashFill(el)
          filled.push({
            label: field.label,
            value: el.options[el.selectedIndex]?.text ?? field.value,
            selector: field.selector,
          })
        }
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el.value.trim()) continue // Don't overwrite existing values
        setNativeValue(el, field.value)
        flashFill(el)
        filled.push({ label: field.label, value: field.value, selector: field.selector })
      }
    } catch { /* skip bad element */ }
  }

  return filled
}

// ─── Workday combobox (async) ────────────────────────────────────────────────
// Workday uses custom combobox components (not native <select>) for fields like
// State/Province. These require: click trigger → wait for options → click match.
// The polling approach works because queryShadowAll traverses shadow roots each
// call, unlike MutationObserver which can't observe cross-root mutations from
// document.body.

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
}

// Maps data-automation-id patterns to their value resolvers for Workday comboboxes
const WORKDAY_COMBOBOX_MAP: Array<{ ids: RegExp; resolve: Resolver; label: string }> = [
  {
    ids: /^countryRegion$|^formField-countryRegion$|^stateProvince$|^addressSection_stateProvince$|^countryRegionAbbreviation$/,
    resolve: (p) => parseAddress(p.user.address ?? '').state,
    label: 'State / Province',
  },
]

function waitForMenuItems(timeoutMs = 1500): Promise<HTMLElement[]> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs
    const check = () => {
      const items = queryShadowAll<HTMLElement>('[data-automation-id="menuItem"]')
      if (items.length > 0) { resolve(items); return }
      if (Date.now() >= deadline) { resolve([]); return }
      setTimeout(check, 100)
    }
    check()
  })
}

async function clickWorkdayCombobox(wrapper: Element, targetValue: string): Promise<boolean> {
  const fullName = US_STATES[targetValue.toUpperCase()] ?? targetValue
  const normalized = fullName.toLowerCase()
  const abbr = targetValue.toLowerCase()

  // Click the trigger inside the wrapper (button, combobox role, or the wrapper itself)
  const trigger =
    queryShadowAll<HTMLElement>('button, [role="combobox"], [role="button"], [aria-haspopup]', wrapper)
      .find((el) => isElementFillable(el)) ??
    (wrapper as HTMLElement)

  trigger.click()

  const menuItems = await waitForMenuItems(1500)
  if (menuItems.length === 0) return false

  const match = menuItems.find((li) => {
    const text = li.textContent?.trim().toLowerCase() ?? ''
    return text === normalized || text === abbr || text.startsWith(normalized)
  })
  if (!match) return false

  match.click()
  return true
}

export async function fillWorkdayComboboxes(profile: FullProfile): Promise<FilledField[]> {
  const filled: FilledField[] = []

  for (const { ids, resolve, label } of WORKDAY_COMBOBOX_MAP) {
    try {
      const value = resolve(profile)
      if (!value) continue

      const wrappers = queryShadowAll<HTMLElement>('[data-automation-id]').filter((el) =>
        ids.test(el.getAttribute('data-automation-id') ?? '')
      )

      for (const wrapper of wrappers) {
        if (!isElementFillable(wrapper)) continue
        const automationId = wrapper.getAttribute('data-automation-id') ?? ''
        const success = await clickWorkdayCombobox(wrapper, value)
        if (success) {
          const displayValue = US_STATES[value.toUpperCase()] ?? value
          flashFill(wrapper)
          filled.push({ label, value: displayValue, selector: `[data-automation-id="${automationId}"]` })
          break
        }
      }
    } catch { /* skip */ }
  }

  return filled
}

// ─── Lever-specific filler ────────────────────────────────────────────────────

function fillLever(profile: FullProfile): FilledField[] {
  const filled: FilledField[] = []

  const inputMap: Array<{ placeholder: RegExp; label: string; value: string | null }> = [
    { placeholder: /full name/i, label: 'Full name', value: profile.user.full_name },
    { placeholder: /email/i, label: 'Email', value: profile.user.email },
    { placeholder: /phone/i, label: 'Phone', value: profile.user.phone },
    { placeholder: /linkedin/i, label: 'LinkedIn', value: profile.user.linkedin_url },
    { placeholder: /twitter/i, label: 'Twitter', value: null },
    { placeholder: /github/i, label: 'GitHub', value: profile.user.github_url },
    { placeholder: /website|portfolio/i, label: 'Website', value: profile.user.portfolio_url },
  ]

  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="email"], input[type="tel"]')
  for (const input of inputs) {
    const ph = input.placeholder
    for (const { placeholder, label, value } of inputMap) {
      if (placeholder.test(ph) && value) {
        setNativeValue(input, value)
        const selector = `input[placeholder="${ph}"]`
        filled.push({ label, value, selector })
        break
      }
    }
  }

  return filled
}

// ─── Collect unfilled fields for Tier 2 (Haiku) analysis ─────────────────────

export function getUnfilledFields(filledSelectors: Set<string>): UnfilledField[] {
  const unfilled: UnfilledField[] = []
  const seen = new Set<Element>()

  const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], textarea'
  )
  for (const input of inputs) {
    try {
      if (seen.has(input)) continue
      seen.add(input)
      const selector = input.id ? `#${CSS.escape(input.id)}` : `[name="${input.getAttribute('name')}"]`
      if (filledSelectors.has(selector)) continue
      if (input.value.trim()) continue
      const label = getLabelForInput(input)
      if (!label) continue
      if (SKIP_LABEL_PATTERNS.test(label)) continue
      const type = input instanceof HTMLTextAreaElement ? 'textarea'
        : (input.type as UnfilledField['type']) || 'text'
      unfilled.push({ selector, label, type })
    } catch { /* skip */ }
  }

  const selects = document.querySelectorAll<HTMLSelectElement>('select')
  for (const select of selects) {
    try {
      if (seen.has(select)) continue
      seen.add(select)
      const selector = select.id ? `#${CSS.escape(select.id)}` : `[name="${select.getAttribute('name')}"]`
      if (filledSelectors.has(selector)) continue
      if (select.value && select.selectedIndex > 0) continue
      const label = getLabelForInput(select)
      if (!label) continue
      if (SKIP_LABEL_PATTERNS.test(label)) continue
      const options = Array.from(select.options)
        .slice(1)
        .map((o) => o.text.trim())
        .filter(Boolean)
      unfilled.push({ selector, label, type: 'select', options })
    } catch { /* skip */ }
  }

  return unfilled
}

// ─── Apply Tier 2 field values ────────────────────────────────────────────────

export function applyFieldValues(fields: Array<{ selector: string; value: string }>): FilledField[] {
  const filled: FilledField[] = []

  for (const { selector, value } of fields) {
    if (!value.trim()) continue
    try {
      const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
      if (input && !input.value.trim()) {
        setNativeValue(input, value)
        const label = getLabelForInput(input)
        filled.push({ label: label || selector, value, selector })
        continue
      }
      const select = document.querySelector<HTMLSelectElement>(selector)
      if (select && (!select.value || select.selectedIndex === 0)) {
        const before = select.value
        setSelectValue(select, value)
        if (select.value !== before) {
          const label = getLabelForInput(select)
          filled.push({ label: label || selector, value: select.options[select.selectedIndex]?.text ?? value, selector })
        }
      }
    } catch { /* skip bad selector */ }
  }

  return filled
}

// ─── Main entry ───────────────────────────────────────────────────────────────
// fillForm uses computeFills + applyFills internally.
// This preserves the existing API for background service worker and content script callers.

export function fillForm(profile: FullProfile, ats: AtsType): FillResult {
  const skipped: SkippedField[] = []
  let filled: FilledField[] = []

  try {
    if (ats === 'lever') {
      // Lever: start with placeholder-based fills, then generic label fills
      const leverFilled = fillLever(profile)
      const leverSelectors = new Set(leverFilled.map((f) => f.selector))
      const scanned = computeFills(profile, ats)
      const genericFilled = applyFills(scanned.filter((f) => !leverSelectors.has(f.selector)))
      filled = [...leverFilled, ...genericFilled]
    } else {
      // greenhouse, workday, generic — all go through computeFills + applyFills
      const scanned = computeFills(profile, ats)
      filled = applyFills(scanned)
    }

    const filledSelectors = new Set(filled.map((f) => f.selector))
    const unfilledFields = getUnfilledFields(filledSelectors)

    if (!profile.user.full_name) skipped.push({ label: 'Name', reason: 'Not set in profile' })
    if (!profile.user.email) skipped.push({ label: 'Email', reason: 'Not set in profile' })
    if (!profile.user.phone) skipped.push({ label: 'Phone', reason: 'Not set in profile' })
    if (!profile.user.resume_url) skipped.push({ label: 'Resume', reason: 'Upload resume in Backlog first' })

    return { filled, skipped, unfilledFields }
  } catch (err) {
    console.error('[Backlog] Fill error:', err)
    return { filled, skipped, unfilledFields: [] }
  }
}
