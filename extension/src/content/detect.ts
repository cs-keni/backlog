import type { AtsType, PageInfo, PageTypeInfo } from '../shared/types'
import { queryShadowAll } from '../shared/domUtils'
import { detectLcProblem } from '../shared/leetcode-problems'
import type { LcProblem } from '../shared/leetcode-problems'

// ─── LeetCode problem detection ───────────────────────────────────────────────
// Extracts the problem slug from a LeetCode URL and checks if it's in the
// NeetCode 150 list. Returns null for non-problem pages or off-list problems.

export function detectLeetCodeProblem(url: string): LcProblem | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('leetcode.com')) return null
    // LeetCode problem URLs: /problems/:slug/ or /problems/:slug/description/ etc.
    const match = parsed.pathname.match(/^\/problems\/([^/]+)/)
    if (!match) return null
    const slug = match[1]
    return detectLcProblem(slug)
  } catch {
    return null
  }
}

export function detectAts(url: string): AtsType {
  if (/boards\.greenhouse\.io/.test(url) || /[?&]gh_jid=/.test(url)) return 'greenhouse'
  if (/jobs\.lever\.co/.test(url) || /[?&]lever_job_id=/.test(url)) return 'lever'
  if (/myworkdayjobs\.com|workday\.com/.test(url)) return 'workday'

  // iCIMS/BambooHR host job postings at /jobs/<id>/... but also serve login,
  // password-reset, and account pages on the *same* domain — those aren't job
  // pages even though the URL matches. Only short-circuit to 'generic' for
  // confirmed job-posting paths; everything else falls through to the (much
  // stricter) DOM-based form check below.
  if (/icims\.com|bamboohr\.com/.test(url)) {
    try {
      if (/\/jobs\/\d+(?:[/?#]|$)/.test(new URL(url).pathname)) return 'generic'
    } catch { /* malformed URL — fall through to DOM-based detection */ }
  }

  // Detect Greenhouse by DOM markers (embedded via script, not iframe)
  if (typeof (window as Record<string, unknown>).Grnhse !== 'undefined') return 'greenhouse'
  // Check if the page has a job application form (best-effort generic detection)
  if (hasJobForm()) return 'generic'
  return null
}

function hasJobForm(): boolean {
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea')
  if (inputs.length < 3) return false

  const emailInput = document.querySelector(
    'input[type="email"], input[name*="email" i], input[id*="email" i]'
  )
  if (!emailInput) return false

  // Require at least one strong job-application-specific signal beyond email.
  // This prevents false positives on login pages, search pages, auth flows, etc.

  // Resume file upload — the clearest single signal
  if (document.querySelector('input[type="file"]')) return true

  // LinkedIn or GitHub URL fields
  if (document.querySelector(
    'input[name*="linkedin" i], input[id*="linkedin" i], input[placeholder*="linkedin" i],' +
    'input[name*="github" i], input[id*="github" i], input[placeholder*="github" i]'
  )) return true

  // Job-application-specific label text. Phrases like "resume" or "work
  // authorization" are essentially unique to job applications.
  const labels = Array.from(document.querySelectorAll('label')).map((l) => l.textContent?.toLowerCase() ?? '')
  if (labels.some((t) => /\bresume\b|cover\s+letter|work\s+auth|\bsponsorship\b/i.test(t))) return true

  // Brand-name mentions (LinkedIn/GitHub/portfolio) only count when the SAME
  // label also references a profile/URL/handle. Bare brand mentions show up
  // constantly on those platforms' own pages — e.g. GitHub's settings UI is
  // full of the literal word "GitHub" — so requiring co-occurring
  // "profile"/"url"/"link" wording keeps real "GitHub Profile URL" fields
  // while rejecting the platforms' own UI text.
  const BRAND_PROFILE = /\b(?:linkedin|github|portfolio)\b.{0,30}\b(?:url|link|profile|username|handle)\b|\b(?:url|link|profile|username|handle)\b.{0,30}\b(?:linkedin|github|portfolio)\b/i
  if (labels.some((t) => BRAND_PROFILE.test(t))) return true

  return false
}

export function extractPageInfo(): PageInfo {
  const url = window.location.href
  const ats = detectAts(url)

  let jobTitle: string | null = null
  let company: string | null = null
  let jobDescription: string | null = null

  if (ats === 'greenhouse') {
    jobTitle = document.querySelector('h1.app-title, h1[class*="title"]')?.textContent?.trim() ?? null
    company = document.querySelector('.company-name, [class*="company"]')?.textContent?.trim() ?? null
    jobDescription = document.querySelector('#content, .content')?.textContent?.trim().slice(0, 2000) ?? null
  } else if (ats === 'lever') {
    jobTitle = document.querySelector('.posting-headline h2, h2[class*="posting"]')?.textContent?.trim() ?? null
    company = document.querySelector('.main-header-text h1, [data-qa="company-name"]')?.textContent?.trim() ?? null
    jobDescription = document.querySelector('.posting-description, [class*="description"]')?.textContent?.trim().slice(0, 2000) ?? null
  } else {
    // Generic: try common patterns
    jobTitle = (
      document.querySelector('h1[class*="job"], h1[class*="title"], h1[class*="position"]') ??
      document.querySelector('h1')
    )?.textContent?.trim() ?? null
    company = document.querySelector('[class*="company"], [class*="employer"]')?.textContent?.trim() ?? null
    jobDescription = document.querySelector('[class*="description"], [class*="overview"]')?.textContent?.trim().slice(0, 2000) ?? null
  }

  // Fallback: grab page <title>
  if (!jobTitle) {
    const title = document.title
    // Strip common suffixes like "| Greenhouse" or "- Lever"
    jobTitle = title.replace(/\s*[\|–\-]\s*(Greenhouse|Lever|Workday|Indeed|LinkedIn|Glassdoor).*$/i, '').trim() || null
  }

  return {
    ats,
    jobTitle,
    company,
    jobDescription,
    isJobPage: ats !== null,
  }
}

// ─── Next-button detection ────────────────────────────────────────────────────
// Finds the "Next" / "Continue" button on multi-step application forms.
// Returns null if a modal is visible (user must handle it first).

const NEXT_TEXT = /\b(next|continue|save\s*and\s*continue|proceed|go\s*to\s*next|next\s*step)\b/i
const SKIP_TEXT = /\b(save\s*for\s*later|cancel|back|previous|go\s*back|skip|close)\b/i

export function detectNextButton(): HTMLElement | null {
  // Don't advance if a modal is open
  if (isModalVisible()) return null

  // Workday-specific: stable automation-id attributes on next/continue buttons
  const workdayBtn = queryShadowAll<HTMLElement>(
    '[data-automation-id="nextButton"], [data-automation-id="bottomNavigationNext"], [data-automation-id="continueButton"]'
  ).find(isVisible)
  if (workdayBtn) return workdayBtn

  // Generic: text-pattern scan across both light DOM and shadow DOM
  const BTN_SELECTOR = 'button[type="submit"], button[type="button"], button:not([type]), input[type="button"], input[type="submit"]'
  const candidates = queryShadowAll<HTMLElement>(BTN_SELECTOR)

  for (const btn of candidates) {
    const rawText = btn instanceof HTMLInputElement
      ? btn.value
      : (btn.textContent ?? btn.getAttribute('aria-label') ?? '')
    const text = rawText.trim()
    if (!NEXT_TEXT.test(text)) continue
    if (SKIP_TEXT.test(text)) continue
    if (!isVisible(btn)) continue
    return btn
  }
  return null
}

// ─── Page type detection ──────────────────────────────────────────────────────
// Classifies the current page as: has-next, final-submit, or modal-blocked.

export function detectPageType(): PageTypeInfo {
  const hasVisibleModal = isModalVisible()
  const nextBtn = detectNextButton()
  const hasNextButton = nextBtn !== null

  // Look for a submit button that isn't also a Next button — shadow-aware
  const submitBtns = queryShadowAll<HTMLElement>(
    'button[type="submit"], input[type="submit"], [data-automation-id="submitButton"]'
  ).filter(isVisible)

  const hasFinalSubmit = !hasNextButton && submitBtns.length > 0

  return {
    hasNextButton,
    hasFinalSubmit,
    hasVisibleModal,
    nextButtonText: nextBtn
      ? (nextBtn instanceof HTMLInputElement ? nextBtn.value : nextBtn.textContent?.trim())
      : undefined,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isModalVisible(): boolean {
  // ARIA dialog (most accessible implementations)
  const ariaDialog = document.querySelector('[role="dialog"]:not([aria-hidden="true"]), [aria-modal="true"]:not([hidden])')
  if (ariaDialog) return true
  // Bootstrap / common modal classes
  const bootstrapModal = document.querySelector('.modal.show, .modal.open, .modal-open .modal:not([aria-hidden])')
  if (bootstrapModal) return true
  return false
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  if (parseFloat(style.opacity) === 0) return false
  if ((el as HTMLButtonElement).disabled) return false
  return true
}
