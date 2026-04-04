import type { FullProfile, FilledField, SkippedField, FillResult, AtsType, UnfilledField } from '../shared/types'

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

// ─── Label extraction ─────────────────────────────────────────────────────────

function getLabelForInput(input: Element): string {
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
  // 7. placeholder
  const placeholder = (input as HTMLInputElement).placeholder
  if (placeholder) return placeholder.toLowerCase()
  // 8. name attribute
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
  { patterns: /phone|mobile|tel/, resolve: (p) => p.user.phone },
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

// ─── Lever-specific filler ────────────────────────────────────────────────────

function fillLever(profile: FullProfile): FilledField[] {
  const filled: FilledField[] = []

  // Lever uses placeholder text to identify fields
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

// Labels to never auto-fill
const SKIP_LABEL_PATTERNS = /referr(ed|al)|someone else|employee.*email|recruiter/

// ─── Shadow DOM traversal (Workday) ──────────────────────────────────────────
// Workday renders inputs inside Shadow DOM. We need to traverse shadow roots
// to find and fill them. Best-effort — some Workday forms require manual correction.

function queryShadowAll<T extends Element>(selector: string, root: Document | ShadowRoot = document): T[] {
  const results: T[] = Array.from(root.querySelectorAll<T>(selector))
  // Traverse all shadow hosts
  for (const host of root.querySelectorAll('*')) {
    if (host.shadowRoot) {
      results.push(...queryShadowAll<T>(selector, host.shadowRoot))
    }
  }
  return results
}

// ─── Generic filler ───────────────────────────────────────────────────────────

function fillGeneric(profile: FullProfile, ats: AtsType): FilledField[] {
  const filled: FilledField[] = []
  const seen = new Set<Element>()

  // For Workday, traverse shadow DOM in addition to regular DOM
  const queryInputs = ats === 'workday'
    ? () => queryShadowAll<HTMLInputElement | HTMLTextAreaElement>(
        'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], textarea'
      )
    : () => Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], textarea'
      ))

  const querySelects = ats === 'workday'
    ? () => queryShadowAll<HTMLSelectElement>('select')
    : () => Array.from(document.querySelectorAll<HTMLSelectElement>('select'))

  // Text inputs and textareas
  for (const input of queryInputs()) {
    try {
      if (seen.has(input)) continue
      seen.add(input)
      const label = getLabelForInput(input)
      if (!label) continue
      if (SKIP_LABEL_PATTERNS.test(label)) continue
      const value = resolveField(label, profile)
      if (!value) continue
      setNativeValue(input, value)
      const selector = input.id ? `#${input.id}` : `[name="${input.getAttribute('name')}"]`
      filled.push({ label, value, selector })
    } catch { /* skip bad element */ }
  }

  // <select> dropdowns
  for (const select of querySelects()) {
    try {
      if (seen.has(select)) continue
      seen.add(select)
      const label = getLabelForInput(select)
      if (!label) continue
      if (SKIP_LABEL_PATTERNS.test(label)) continue
      const value = resolveField(label, profile)
      if (!value) continue
      const before = select.value
      setSelectValue(select, value)
      if (select.value !== before && select.value !== '') {
        const selector = select.id ? `#${select.id}` : `[name="${select.getAttribute('name')}"]`
        filled.push({ label, value: select.options[select.selectedIndex]?.text ?? value, selector })
      }
    } catch { /* skip bad element */ }
  }

  return filled
}

// ─── Collect unfilled fields for Tier 2 (Haiku) analysis ─────────────────────
// Returns descriptors for inputs/selects that are currently empty after Tier 1.
// These are sent to the analyze-page endpoint for Haiku to map to profile values
// or identify as open-ended questions needing Sonnet.

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
      // Skip if already filled by Tier 1
      const selector = input.id ? `#${input.id}` : `[name="${input.getAttribute('name')}"]`
      if (filledSelectors.has(selector)) continue
      // Skip if already has a value
      if (input.value.trim()) continue
      const label = getLabelForInput(input)
      if (!label) continue
      if (SKIP_LABEL_PATTERNS.test(label)) continue
      const type = input instanceof HTMLTextAreaElement ? 'textarea'
        : (input.type as UnfilledField['type']) || 'text'
      unfilled.push({ selector, label, type })
    } catch { /* skip */ }
  }

  // <select> dropdowns with no selection
  const selects = document.querySelectorAll<HTMLSelectElement>('select')
  for (const select of selects) {
    try {
      if (seen.has(select)) continue
      seen.add(select)
      const selector = select.id ? `#${select.id}` : `[name="${select.getAttribute('name')}"]`
      if (filledSelectors.has(selector)) continue
      // Skip if a non-placeholder option is selected
      if (select.value && select.selectedIndex > 0) continue
      const label = getLabelForInput(select)
      if (!label) continue
      if (SKIP_LABEL_PATTERNS.test(label)) continue
      const options = Array.from(select.options)
        .slice(1) // skip the placeholder option
        .map((o) => o.text.trim())
        .filter(Boolean)
      unfilled.push({ selector, label, type: 'select', options })
    } catch { /* skip */ }
  }

  return unfilled
}

// ─── Apply Tier 2 field values ────────────────────────────────────────────────
// Applies values returned by the analyze-page or answer-question endpoints.
// Only fills fields that are currently empty — never overwrites Tier 1 fills.

export function applyFieldValues(fields: Array<{ selector: string; value: string }>): FilledField[] {
  const filled: FilledField[] = []

  for (const { selector, value } of fields) {
    if (!value.trim()) continue
    try {
      // Try <input> / <textarea>
      const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
      if (input && !input.value.trim()) {
        setNativeValue(input, value)
        const label = getLabelForInput(input)
        filled.push({ label: label || selector, value, selector })
        continue
      }
      // Try <select>
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

export function fillForm(profile: FullProfile, ats: AtsType): FillResult {
  const skipped: SkippedField[] = []
  let filled: FilledField[] = []

  try {
    if (ats === 'lever') {
      filled = fillLever(profile)
      const generic = fillGeneric(profile, ats)
      const filledSelectors = new Set(filled.map((f) => f.selector))
      filled.push(...generic.filter((f) => !filledSelectors.has(f.selector)))
    } else {
      // greenhouse, workday, generic, null — all use the generic label-based filler
      // Workday also traverses Shadow DOM (handled inside fillGeneric)
      filled = fillGeneric(profile, ats)
    }

    // Collect unfilled fields for Tier 2
    const filledSelectors = new Set(filled.map((f) => f.selector))
    const unfilledFields = getUnfilledFields(filledSelectors)

    // Note fields we couldn't fill
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
