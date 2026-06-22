import type { HandshakeJobData } from '../shared/types'

// ─── DOM scraper ──────────────────────────────────────────────────────────────
// Handshake is a React SPA. After a `backlog:navigation` event the DOM may not
// be ready yet, so we retry with a MutationObserver up to 12 s.

const SCRAPE_TIMEOUT_MS = 12000

interface BasicJobData {
  jobTitle: string
  company: string | null
}

function attemptBasicScrape(): BasicJobData | null {
  // Job title: first H1 that isn't the search page header ("Jobs") or a modal
  const titleEl = Array.from(document.querySelectorAll<HTMLElement>('h1')).find((el) => {
    const text = el.textContent?.trim() ?? ''
    if (!text || text === 'Jobs') return false
    if (/share this job|reporting|withdrawal/i.test(text)) return false
    return true
  })

  const jobTitle = titleEl?.textContent?.trim() ?? null
  if (!jobTitle) return null

  // Company: Handshake renders "Apply to <Company>" as an H2 in the detail panel
  const applyH2 = Array.from(document.querySelectorAll<HTMLElement>('h2')).find(
    (el) => /^apply to /i.test(el.textContent?.trim() ?? '')
  )
  const company = applyH2
    ? applyH2.textContent!.trim().replace(/^apply to\s+/i, '')
    : null

  return { jobTitle, company }
}

// Click any "More" / "Show more" expand buttons in the job detail panel,
// then wait briefly for the DOM to re-render with the full text.
async function expandDescriptionSections(): Promise<void> {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, span, a')).filter(
    (el) => {
      const text = el.textContent?.trim()
      return text === 'More' || text === 'Show more' || text === 'See more'
    }
  )
  for (const btn of buttons) {
    try { btn.click() } catch { /* ignore */ }
  }
  if (buttons.length > 0) {
    await new Promise<void>((r) => setTimeout(r, 700))
  }
}

function readDescription(): string | null {
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
  return descParts.length > 0 ? descParts.join('\n\n').slice(0, 6000) : null
}

// Phase 1: wait for the job title/company to appear (MutationObserver)
function waitForBasicData(): Promise<BasicJobData | null> {
  return new Promise((resolve) => {
    const immediate = attemptBasicScrape()
    if (immediate) { resolve(immediate); return }

    let settled = false
    const deadline = setTimeout(() => {
      observer.disconnect()
      if (!settled) { settled = true; resolve(null) }
    }, SCRAPE_TIMEOUT_MS)

    const observer = new MutationObserver(() => {
      const data = attemptBasicScrape()
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

export async function scrapeHandshakeJob(): Promise<HandshakeJobData | null> {
  // Phase 1: wait for title + company
  const basics = await waitForBasicData()
  if (!basics) return null

  // Phase 2: expand truncated "More" sections, then read full description
  await expandDescriptionSections()
  const description = readDescription()

  return { ...basics, description }
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

    const isExternalApply =
      anchor.dataset.hook === 'external-apply' ||
      /apply\s+externally|external\s+apply/i.test(anchor.textContent ?? '') ||
      /apply\s+externally|external\s+apply/i.test(anchor.getAttribute('aria-label') ?? '')

    if (!isExternalApply) return

    const basics = attemptBasicScrape()
    if (basics) onCapture({ ...basics, description: readDescription() }, window.location.href)
  }, { capture: true })
}
