import type { AtsType, PageInfo, PageTypeInfo } from '../shared/types'

export function detectAts(url: string): AtsType {
  if (/boards\.greenhouse\.io/.test(url) || /[?&]gh_jid=/.test(url)) return 'greenhouse'
  if (/jobs\.lever\.co/.test(url) || /[?&]lever_job_id=/.test(url)) return 'lever'
  if (/myworkdayjobs\.com|workday\.com/.test(url)) return 'workday'
  if (/icims\.com/.test(url)) return 'generic'
  if (/bamboohr\.com/.test(url)) return 'generic'
  // Detect Greenhouse by DOM markers (embedded via script, not iframe)
  if (typeof (window as Record<string, unknown>).Grnhse !== 'undefined') return 'greenhouse'
  // Check if the page has a job application form (best-effort generic detection)
  if (hasJobForm()) return 'generic'
  return null
}

function hasJobForm(): boolean {
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea')
  if (inputs.length < 3) return false
  // Look for email input — almost always present on job apps
  const emailInput = document.querySelector('input[type="email"], input[name*="email"], input[id*="email"]')
  return emailInput !== null
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

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button[type="submit"], button[type="button"], button:not([type]), input[type="button"], input[type="submit"]'
    )
  )

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

  // Look for a submit button that isn't also a Next button
  const submitBtns = Array.from(
    document.querySelectorAll<HTMLElement>('button[type="submit"], input[type="submit"]')
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
