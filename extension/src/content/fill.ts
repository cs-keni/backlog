import type { FullProfile, FilledField, SkippedField, FillResult, AtsType } from '../shared/types'

// ─── Input value setter ───────────────────────────────────────────────────────
// Works for standard inputs and React/Angular controlled inputs by dispatching
// the native input + change events that frameworks listen to.

function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value'
  )?.set
  nativeInputValueSetter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  // Try exact match first, then case-insensitive partial match
  const lower = value.toLowerCase()
  const option =
    Array.from(select.options).find((o) => o.value === value || o.text === value) ??
    Array.from(select.options).find((o) => o.text.toLowerCase().includes(lower))
  if (option) {
    select.value = option.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

// ─── Label extraction ─────────────────────────────────────────────────────────

function getLabelForInput(input: Element): string {
  // 1. <label for="id">
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`)
    if (label) return label.textContent?.trim().toLowerCase() ?? ''
  }
  // 2. Wrapping <label>
  const parentLabel = input.closest('label')
  if (parentLabel) return parentLabel.textContent?.trim().toLowerCase() ?? ''
  // 3. Previous sibling label
  const prev = input.previousElementSibling
  if (prev?.tagName === 'LABEL') return prev.textContent?.trim().toLowerCase() ?? ''
  // 4. aria-label
  const aria = input.getAttribute('aria-label')
  if (aria) return aria.toLowerCase()
  // 5. placeholder
  const placeholder = (input as HTMLInputElement).placeholder
  if (placeholder) return placeholder.toLowerCase()
  // 6. name attribute
  return (input.getAttribute('name') ?? '').toLowerCase().replace(/[_-]/g, ' ')
}

// ─── Field → profile value mapping ───────────────────────────────────────────

type Resolver = (profile: FullProfile) => string | null

const FIELD_MAP: Array<{ patterns: RegExp; resolve: Resolver }> = [
  { patterns: /first\s*name/, resolve: (p) => p.user.full_name?.split(' ')[0] ?? null },
  { patterns: /last\s*name|surname|family\s*name/, resolve: (p) => p.user.full_name?.split(' ').slice(1).join(' ') || null },
  { patterns: /^(full\s*)?name$|your\s*name/, resolve: (p) => p.user.full_name },
  { patterns: /email/, resolve: (p) => p.user.email },
  { patterns: /phone|mobile|tel/, resolve: (p) => p.user.phone },
  { patterns: /linkedin/, resolve: (p) => p.user.linkedin_url },
  { patterns: /github/, resolve: (p) => p.user.github_url },
  { patterns: /portfolio|personal\s*site|personal\s*website|website|url/, resolve: (p) => p.user.portfolio_url },
  { patterns: /address/, resolve: (p) => p.user.address },
  { patterns: /city/, resolve: (p) => p.user.address?.split(',')[0]?.trim() ?? null },
  { patterns: /state|province|region/, resolve: (p) => p.user.address?.split(',')[1]?.trim() ?? null },
  { patterns: /zip|postal/, resolve: (p) => p.user.address?.split(',').pop()?.trim() ?? null },
  {
    patterns: /authorized|authorization|work\s*auth|legally\s*authorized/,
    resolve: () => 'Yes',
  },
  {
    patterns: /sponsor|visa|require.*sponsor|need.*sponsor/,
    resolve: (p) => (p.user.visa_sponsorship_required ? 'Yes' : 'No'),
  },
  {
    patterns: /relocat/,
    resolve: (p) => (p.user.willing_to_relocate ? 'Yes' : 'No'),
  },
  {
    patterns: /experience.*year|years.*experience|how many years/,
    resolve: (p) => p.user.years_of_experience?.toString() ?? null,
  },
]

function resolveField(label: string, profile: FullProfile): string | null {
  for (const { patterns, resolve } of FIELD_MAP) {
    if (patterns.test(label)) return resolve(profile)
  }
  return null
}

// ─── Greenhouse-specific filler ───────────────────────────────────────────────

function fillGreenhouse(profile: FullProfile): FilledField[] {
  const filled: FilledField[] = []

  const fields: Array<{ selector: string; label: string; value: string | null }> = [
    { selector: '#first_name', label: 'First name', value: profile.user.full_name?.split(' ')[0] ?? null },
    { selector: '#last_name', label: 'Last name', value: profile.user.full_name?.split(' ').slice(1).join(' ') || null },
    { selector: '#email', label: 'Email', value: profile.user.email },
    { selector: '#phone', label: 'Phone', value: profile.user.phone },
    { selector: '#linkedin_profile', label: 'LinkedIn', value: profile.user.linkedin_url },
    { selector: '#website', label: 'Website', value: profile.user.portfolio_url },
  ]

  for (const { selector, label, value } of fields) {
    if (!value) continue
    const el = document.querySelector<HTMLInputElement>(selector)
    if (!el) continue
    setNativeValue(el, value)
    filled.push({ label, value, selector })
  }

  return filled
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

// ─── Generic filler ───────────────────────────────────────────────────────────

function fillGeneric(profile: FullProfile): FilledField[] {
  const filled: FilledField[] = []
  const seen = new Set<Element>()

  const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], textarea'
  )

  for (const input of inputs) {
    if (seen.has(input)) continue
    seen.add(input)

    const label = getLabelForInput(input)
    if (!label) continue

    const value = resolveField(label, profile)
    if (!value) continue

    setNativeValue(input, value)
    const selector = input.id ? `#${input.id}` : `[name="${input.getAttribute('name')}"]`
    filled.push({ label, value, selector })
  }

  return filled
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function fillForm(profile: FullProfile, ats: AtsType): FillResult {
  const skipped: SkippedField[] = []
  let filled: FilledField[] = []

  try {
    if (ats === 'greenhouse') {
      filled = fillGreenhouse(profile)
      // Also run generic to catch custom questions
      const generic = fillGeneric(profile)
      const filledSelectors = new Set(filled.map((f) => f.selector))
      filled.push(...generic.filter((f) => !filledSelectors.has(f.selector)))
    } else if (ats === 'lever') {
      filled = fillLever(profile)
      const generic = fillGeneric(profile)
      const filledSelectors = new Set(filled.map((f) => f.selector))
      filled.push(...generic.filter((f) => !filledSelectors.has(f.selector)))
    } else {
      filled = fillGeneric(profile)
    }

    // Note fields we couldn't fill
    if (!profile.user.full_name) skipped.push({ label: 'Name', reason: 'Not set in profile' })
    if (!profile.user.email) skipped.push({ label: 'Email', reason: 'Not set in profile' })
    if (!profile.user.phone) skipped.push({ label: 'Phone', reason: 'Not set in profile' })
    if (!profile.user.resume_url) skipped.push({ label: 'Resume', reason: 'Upload resume in Backlog first' })
  } catch (err) {
    console.error('[Backlog] Fill error:', err)
  }

  return { filled, skipped }
}
