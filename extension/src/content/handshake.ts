import type { HandshakeJobData } from '../shared/types'

// ─── DOM scraper ──────────────────────────────────────────────────────────────
// Handshake is a React SPA. After a `backlog:navigation` event the DOM may not
// be ready yet, so we retry with a MutationObserver up to 5 s.

const SCRAPE_TIMEOUT_MS = 5000

function attemptScrape(): HandshakeJobData | null {
  // Title — try several selectors in priority order
  const titleEl =
    document.querySelector<HTMLElement>('[data-hook="posting-name"]') ??
    document.querySelector<HTMLElement>('[data-label="job-name"]') ??
    document.querySelector<HTMLElement>('h1.job-name') ??
    document.querySelector<HTMLElement>('h1')

  // Company — employer name appears in the job header
  const companyEl =
    document.querySelector<HTMLElement>('[data-hook="employer-name"]') ??
    document.querySelector<HTMLElement>('[data-label="employer-name"]') ??
    document.querySelector<HTMLElement>('.employer-name') ??
    document.querySelector<HTMLElement>('[class*="employer" i]')

  // Description — Handshake renders it inside a rich-text block
  const descEl =
    document.querySelector<HTMLElement>('[data-hook="description"]') ??
    document.querySelector<HTMLElement>('.posting-description') ??
    document.querySelector<HTMLElement>('[data-label="job-description"]') ??
    document.querySelector<HTMLElement>('[class*="description" i]')

  const jobTitle    = titleEl?.textContent?.trim() ?? null
  const company     = companyEl?.textContent?.trim() ?? null
  const description = descEl?.textContent?.trim().slice(0, 4000) ?? null

  // If we got at least a title we consider the scrape successful
  if (!jobTitle) return null

  return { jobTitle, company, description }
}

export function scrapeHandshakeJob(): Promise<HandshakeJobData | null> {
  return new Promise((resolve) => {
    // Fast path: DOM already ready
    const immediate = attemptScrape()
    if (immediate) { resolve(immediate); return }

    // Slow path: wait for React to render
    let settled = false
    const deadline = setTimeout(() => {
      observer.disconnect()
      if (!settled) { settled = true; resolve(null) }
    }, SCRAPE_TIMEOUT_MS)

    const observer = new MutationObserver(() => {
      const data = attemptScrape()
      if (data && !settled) {
        settled = true
        clearTimeout(deadline)
        observer.disconnect()
        resolve(data)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
}

// ─── "Apply Externally" click interceptor ────────────────────────────────────
// When the user clicks an external-apply link on a Handshake job page, we
// capture the current job data so the background can write it to session
// storage before the tab navigates to the company ATS.

export function installExternalApplyInterceptor(
  onCapture: (data: HandshakeJobData, sourceUrl: string) => void
): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const anchor = target.closest<HTMLAnchorElement>('a')
    if (!anchor) return

    // Matches Handshake's "Apply Externally" links: data-hook attribute or
    // text content containing "apply externally" / "external apply"
    const isExternalApply =
      anchor.dataset.hook === 'external-apply' ||
      /apply\s+externally|external\s+apply/i.test(anchor.textContent ?? '') ||
      /apply\s+externally|external\s+apply/i.test(anchor.getAttribute('aria-label') ?? '')

    if (!isExternalApply) return

    // Capture synchronously — any data we have at click time
    const data = attemptScrape()
    if (data) onCapture(data, window.location.href)
  }, { capture: true })
}
