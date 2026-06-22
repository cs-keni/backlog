import type { HandshakeJobData } from '../shared/types'

// ─── DOM scraper ──────────────────────────────────────────────────────────────

const SCRAPE_TIMEOUT_MS = 12000

// Case-insensitive — Handshake has used at least two casings in the wild
const DESC_SECTION_RE =
  /^(job description|what they.?re looking for|what this job offers|about the role|about this role|responsibilities|role description|what you.?ll do|the role)$/i

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

// Wait for any of the known description headings to appear in the DOM.
function waitForDescriptionSection(): Promise<boolean> {
  return new Promise((resolve) => {
    const found = () =>
      Array.from(document.querySelectorAll<HTMLElement>('h3')).some((el) =>
        DESC_SECTION_RE.test(el.textContent?.trim() ?? '')
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

// Click any collapsed expand buttons near description sections.
async function expandDescriptionSections(): Promise<void> {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, span, a')).filter(
    (el) => {
      const text = el.textContent?.trim()
      if (!text) return false
      return /^(more|show more|see more|read more)$/i.test(text)
    }
  )
  console.log('[Backlog] expandDescriptionSections: found', buttons.length, 'expand buttons')
  for (const btn of buttons) {
    try { btn.click() } catch { /* ignore */ }
  }
  if (buttons.length > 0) {
    await new Promise<void>((r) => setTimeout(r, 1000))
  }
}

function collectText(el: Element): string | null {
  const text = el.textContent?.trim() ?? ''
  if (text.length > 30 && !/^(more|less|show more|see more|show less|read more)$/i.test(text)) {
    return text
  }
  return null
}

function readDescription(): string | null {
  const allH3s = Array.from(document.querySelectorAll<HTMLElement>('h3'))
  console.log('[Backlog] readDescription: H3s on page:', allH3s.map((el) => el.textContent?.trim()))

  const descParts: string[] = []

  for (const h3 of allH3s) {
    if (!DESC_SECTION_RE.test(h3.textContent?.trim() ?? '')) continue

    console.log('[Backlog] readDescription: matched H3:', h3.textContent?.trim())

    // Strategy 1: siblings of H3 itself
    const sectionTexts: string[] = []
    let sibling = h3.nextElementSibling
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) break
      const t = collectText(sibling)
      if (t) sectionTexts.push(t)
      sibling = sibling.nextElementSibling
    }
    console.log('[Backlog] readDescription: S1 siblings found:', sectionTexts.length)

    if (sectionTexts.length > 0) {
      descParts.push(sectionTexts.join('\n'))
      continue
    }

    // Strategy 2: parent's siblings (H3 may be the only child of a header wrapper)
    const parent = h3.parentElement
    if (parent) {
      let psib = parent.nextElementSibling
      while (psib) {
        if (/^H[1-6]$/.test(psib.tagName)) break
        const t = collectText(psib)
        if (t) sectionTexts.push(t)
        psib = psib.nextElementSibling
      }
      console.log('[Backlog] readDescription: S2 parent-siblings found:', sectionTexts.length)

      if (sectionTexts.length > 0) {
        descParts.push(sectionTexts.join('\n'))
        continue
      }

      // Strategy 3: parent's full text minus the H3 label
      const all = parent.textContent?.trim() ?? ''
      const label = h3.textContent?.trim() ?? ''
      const body = all.replace(label, '').trim()
      console.log('[Backlog] readDescription: S3 parent body length:', body.length)
      if (body.length > 30) {
        descParts.push(body)
      }
    }
  }

  console.log('[Backlog] readDescription: final parts:', descParts.length, '| total chars:', descParts.join('').length)
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

  // Phase 2: wait for the description section to render, expand "More", then read
  const descFound = await waitForDescriptionSection()
  console.log('[Backlog] scrapeHandshakeJob: description section found?', descFound)
  await expandDescriptionSections()
  const description = readDescription()
  console.log('[Backlog] scrapeHandshakeJob: description length:', description?.length ?? 0)

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
