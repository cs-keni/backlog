import type { HandshakeJobData } from '../shared/types'

// ─── DOM scraper ──────────────────────────────────────────────────────────────
// Handshake is a React SPA. After a `backlog:navigation` event the DOM may not
// be ready yet, so we retry with a MutationObserver up to 5 s.

const SCRAPE_TIMEOUT_MS = 12000

function attemptScrape(): HandshakeJobData | null {
  // Job title: first H1 that isn't the search page header ("Jobs") or a modal
  const titleEl = Array.from(document.querySelectorAll<HTMLElement>('h1')).find((el) => {
    const text = el.textContent?.trim() ?? ''
    if (!text || text === 'Jobs') return false
    if (/share this job|reporting|withdrawal/i.test(text)) return false
    return true
  })

  // Company: Handshake renders "Apply to <Company>" as an H2 in the detail panel
  const applyH2 = Array.from(document.querySelectorAll<HTMLElement>('h2')).find(
    (el) => /^apply to /i.test(el.textContent?.trim() ?? '')
  )
  const company = applyH2
    ? applyH2.textContent!.trim().replace(/^apply to\s+/i, '')
    : null

  // Description: aggregate content from the relevant H3 section blocks
  const DESC_SECTIONS = ['Job description', "What they're looking for", 'What this job offers']
  const descParts: string[] = []
  for (const h3 of Array.from(document.querySelectorAll<HTMLElement>('h3'))) {
    if (!DESC_SECTIONS.includes(h3.textContent?.trim() ?? '')) continue
    let sibling = h3.nextElementSibling
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) break
      const text = sibling.textContent?.trim() ?? ''
      if (text.length > 20) { descParts.push(text); break }
      sibling = sibling.nextElementSibling
    }
  }
  const description = descParts.length > 0 ? descParts.join('\n\n').slice(0, 4000) : null

  const jobTitle = titleEl?.textContent?.trim() ?? null
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
