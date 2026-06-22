import type { HandshakeJobData } from '../shared/types'

// ─── DOM scraper ──────────────────────────────────────────────────────────────

const SCRAPE_TIMEOUT_MS = 12000
const DESC_SECTIONS = ['Job description', "What they're looking for", 'What this job offers']

interface BasicJobData {
  jobTitle: string
  company: string | null
}

function attemptBasicScrape(): BasicJobData | null {
  const titleEl = Array.from(document.querySelectorAll<HTMLElement>('h1')).find((el) => {
    const text = el.textContent?.trim() ?? ''
    if (!text || text === 'Jobs') return false
    if (/share this job|reporting|withdrawal/i.test(text)) return false
    return true
  })

  const jobTitle = titleEl?.textContent?.trim() ?? null
  if (!jobTitle) return null

  const applyH2 = Array.from(document.querySelectorAll<HTMLElement>('h2')).find(
    (el) => /^apply to /i.test(el.textContent?.trim() ?? '')
  )
  const company = applyH2
    ? applyH2.textContent!.trim().replace(/^apply to\s+/i, '')
    : null

  return { jobTitle, company }
}

// Wait for any of the known description H3s to appear in the DOM.
function waitForDescriptionSection(): Promise<boolean> {
  return new Promise((resolve) => {
    const found = () =>
      Array.from(document.querySelectorAll<HTMLElement>('h3')).some((el) =>
        DESC_SECTIONS.includes(el.textContent?.trim() ?? '')
      )

    if (found()) { resolve(true); return }

    let settled = false
    const deadline = setTimeout(() => {
      observer.disconnect()
      if (!settled) { settled = true; resolve(false) }
    }, 5000)

    const observer = new MutationObserver(() => {
      if (found() && !settled) {
        settled = true
        clearTimeout(deadline)
        observer.disconnect()
        resolve(true)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
}

// Click any collapsed "More" / "Show more" expand buttons near description sections.
async function expandDescriptionSections(): Promise<void> {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, span, a')).filter(
    (el) => {
      const text = el.textContent?.trim()
      if (!text) return false
      return /^(more|show more|see more|read more)$/i.test(text)
    }
  )
  for (const btn of buttons) {
    try { btn.click() } catch { /* ignore */ }
  }
  if (buttons.length > 0) {
    await new Promise<void>((r) => setTimeout(r, 1000))
  }
}

function readDescription(): string | null {
  const descParts: string[] = []

  for (const h3 of Array.from(document.querySelectorAll<HTMLElement>('h3'))) {
    if (!DESC_SECTIONS.includes(h3.textContent?.trim() ?? '')) continue

    // Collect ALL siblings after this H3 until the next heading.
    const sectionTexts: string[] = []
    let sibling = h3.nextElementSibling
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) break
      const text = sibling.textContent?.trim() ?? ''
      // Skip "More"/"Less" expand/collapse labels and very short fragments
      if (text.length > 30 && !/^(more|less|show more|see more|show less|read more)$/i.test(text)) {
        sectionTexts.push(text)
      }
      sibling = sibling.nextElementSibling
    }

    if (sectionTexts.length > 0) {
      descParts.push(sectionTexts.join('\n'))
    } else {
      // Fallback: read parent container's text (minus the H3 label itself)
      const parent = h3.parentElement
      if (parent) {
        const all = parent.textContent?.trim() ?? ''
        const label = h3.textContent?.trim() ?? ''
        const body = all.replace(label, '').trim()
        if (body.length > 30) descParts.push(body)
      }
    }
  }

  return descParts.length > 0 ? descParts.join('\n\n').slice(0, 6000) : null
}

// Phase 1: wait for the job title/company to appear
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

  // Phase 2: wait for the description section to render (it often appears slightly
  // after the title), then expand any collapsed "More" sections, then read
  await waitForDescriptionSection()
  await expandDescriptionSections()
  const description = readDescription()

  return { ...basics, description }
}

// ─── "Apply Externally" click interceptor ────────────────────────────────────

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
