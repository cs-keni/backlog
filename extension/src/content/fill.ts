import type { FullProfile, FilledField, SkippedField, FillResult, AtsType, UnfilledField, ScannedField } from '../shared/types'

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
  { patterns: /address/, resolve: (p) => p.user.address },
  // City+State combined must come before individual city/state patterns
  {
    patterns: /\bcity\b.*\bstate\b|\bcity.*province/,
    resolve: (p) => {
      const parts = p.user.address?.split(',').map((s) => s.trim()) ?? []
      return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : (p.user.address ?? null)
    },
  },
  { patterns: /\bcity\b/, resolve: (p) => p.user.address?.split(',')[0]?.trim() ?? null },
  // Use word boundary so "United States" and "statements" don't match
  { patterns: /\bstate\b|\bprovince\b|\bregion\b/, resolve: (p) => p.user.address?.split(',')[1]?.trim() ?? null },
  { patterns: /zip|postal/, resolve: (p) => p.user.address?.split(',').pop()?.trim() ?? null },
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
  // Address
  { ids: /^addressLine1$|^addressSection_addressLine1$/, resolve: (p) => p.user.address?.split(',')[0]?.trim() ?? null },
  { ids: /^city$|^addressSection_city$/, resolve: (p) => p.user.address?.split(',')[0]?.trim() ?? null },
  { ids: /^postalCode$|^zipCode$|^addressSection_postalCode$/, resolve: (p) => p.user.address?.split(',').pop()?.trim() ?? null },
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
// Scoped to form containers first (fast), falls back to full document.
// Workday renders inputs inside nested shadow roots — must recurse into each.

export function queryShadowAll<T extends Element>(selector: string, root: Document | ShadowRoot | Element = document): T[] {
  const results: T[] = Array.from((root as Document | ShadowRoot | Element).querySelectorAll<T>(selector))
  for (const host of (root as Document | ShadowRoot | Element).querySelectorAll('*')) {
    if ((host as Element & { shadowRoot?: ShadowRoot }).shadowRoot) {
      results.push(...queryShadowAll<T>(selector, (host as Element & { shadowRoot: ShadowRoot }).shadowRoot))
    }
  }
  return results
}

function queryShadowScoped<T extends Element>(selector: string): T[] {
  // Try form containers first (much faster on React-heavy Workday pages)
  const containers = Array.from(document.querySelectorAll<Element>(
    'form, main, [role="main"], [data-automation-id]'
  ))
  if (containers.length === 0) return queryShadowAll<T>(selector)

  const seen = new Set<T>()
  const results: T[] = []
  for (const container of containers) {
    for (const el of queryShadowAll<T>(selector, container)) {
      if (!seen.has(el)) { seen.add(el); results.push(el) }
    }
  }
  // Fallback: if scoped traversal found nothing, try full document
  if (results.length === 0) return queryShadowAll<T>(selector)
  return results
}

// ─── Labels to never auto-fill ────────────────────────────────────────────────
const SKIP_LABEL_PATTERNS = /referr(ed|al)|someone else|employee.*email|recruiter/

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
        })
      } catch { /* skip */ }
    }
  }

  return scanned
}

// ─── applyFills — DOM write pass ─────────────────────────────────────────────
// Takes the output of computeFills and writes to DOM.
// Uses WeakRef to get the live element — skips gracefully if element was unmounted.

export function applyFills(fields: ScannedField[]): FilledField[] {
  const filled: FilledField[] = []

  for (const field of fields) {
    try {
      const el = field.elRef.deref()
      if (!el) continue // Element was garbage collected / unmounted

      if (el instanceof HTMLSelectElement) {
        const before = el.value
        setSelectValue(el, field.value)
        if (el.value !== before && el.value !== '') {
          filled.push({
            label: field.label,
            value: el.options[el.selectedIndex]?.text ?? field.value,
            selector: field.selector,
          })
        }
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el.value.trim()) continue // Don't overwrite existing values
        setNativeValue(el, field.value)
        filled.push({ label: field.label, value: field.value, selector: field.selector })
      }
    } catch { /* skip bad element */ }
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
