import { extractPageInfo } from './detect'
import { fillForm, applyFieldValues } from './fill'
import { detectNextButton, detectPageType } from './detect'
import type { ExtensionMessage, FillResult, PageInfo, PageTypeInfo } from '../shared/types'

// Cache detection result so the popup always gets the latest known state.
// Greenhouse and other ATS forms often render asynchronously via JS, so the
// form may not exist at document_idle. The MutationObserver below updates
// this cache the moment inputs appear.
let cachedPageInfo: PageInfo = { ats: null, jobTitle: null, company: null, jobDescription: null, isJobPage: false }
let submissionWatched = false

function refreshCache(): PageInfo {
  try {
    cachedPageInfo = extractPageInfo()
    if (cachedPageInfo.isJobPage && !submissionWatched) {
      submissionWatched = true
      watchForSubmission()
    }
  } catch { /* ignore */ }
  return cachedPageInfo
}

// Watch for dynamically injected forms (Greenhouse embed, SPA routing, etc.)
try {
  const observer = new MutationObserver(() => {
    if (!cachedPageInfo.isJobPage) refreshCache()
  })
  if (document.body) observer.observe(document.body, { childList: true, subtree: true })
} catch { /* ignore */ }

// ─── Navigation re-trigger ────────────────────────────────────────────────────
// Listen for the custom event dispatched by navigation.ts (world: MAIN).
// On SPA navigation, reset the detection cache and notify the background.
window.addEventListener('backlog:navigation', (e) => {
  const url = (e as CustomEvent<{ url: string }>).detail?.url ?? location.href
  submissionWatched = false
  cachedPageInfo = { ats: null, jobTitle: null, company: null, jobDescription: null, isJobPage: false }
  // Small delay to allow the new page DOM to settle
  setTimeout(() => {
    refreshCache()
    chrome.runtime.sendMessage({ type: 'PAGE_NAVIGATED', payload: { url } } as ExtensionMessage)
  }, 300)
})

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  // ── GET_PAGE_INFO ──────────────────────────────────────────────────────────
  if (message.type === 'GET_PAGE_INFO') {
    sendResponse(refreshCache())
    return true
  }

  // ── FILL_FORM (backward compat) or FILL_FORM_TIER1 ────────────────────────
  // Runs the deterministic Tier 1 fill and returns results + unfilled field
  // descriptors for Tier 2 (Haiku) processing by the popup/background.
  if (message.type === 'FILL_FORM' || message.type === 'FILL_FORM_TIER1') {
    const waitForInputs = (cb: () => void) => {
      const ready = () => document.querySelector(
        '#email, input[type="email"], input[type="text"]'
      ) !== null
      if (ready()) { cb(); return }
      let tries = 0
      const t = setInterval(() => {
        tries++
        if (ready() || tries > 30) { clearInterval(t); cb() }
      }, 200)
    }
    waitForInputs(() => {
      const { ats } = cachedPageInfo
      const result: FillResult = fillForm(message.payload, ats)
      sendResponse(result)
    })
    return true
  }

  // ── FILL_FORM_TIER2 ───────────────────────────────────────────────────────
  // Applies Haiku-returned field values and Sonnet-generated answers.
  // Only fills fields that are currently empty — never overwrites Tier 1.
  if (message.type === 'FILL_FORM_TIER2') {
    try {
      const filled = applyFieldValues(message.payload.fields)
      sendResponse({ filled })
    } catch (err) {
      console.error('[Backlog] Tier 2 fill error:', err)
      sendResponse({ filled: [] })
    }
    return true
  }

  // ── DETECT_PAGE_TYPE ──────────────────────────────────────────────────────
  if (message.type === 'DETECT_PAGE_TYPE') {
    const info: PageTypeInfo = detectPageType()
    sendResponse(info)
    return true
  }

  // ── CLICK_NEXT_BUTTON ─────────────────────────────────────────────────────
  if (message.type === 'CLICK_NEXT_BUTTON') {
    const btn = detectNextButton()
    if (btn) {
      btn.click()
      sendResponse({ found: true })
    } else {
      sendResponse({ found: false })
    }
    return true
  }

  if (message.type === 'ADD_TO_BACKLOG') {
    return false
  }
})

// ─── Submission detection ─────────────────────────────────────────────────────

function watchForSubmission() {
  const info = cachedPageInfo
  let submitted = false

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', () => {
      if (submitted) return
      submitted = true
      chrome.runtime.sendMessage({
        type: 'MARK_APPLIED',
        payload: {
          jobUrl: window.location.href,
          jobTitle: info.jobTitle,
          company: info.company,
        },
      } as ExtensionMessage)
    })
  })

  document.querySelectorAll('button[type="submit"], input[type="submit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (submitted) return
      submitted = true
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'MARK_APPLIED',
          payload: {
            jobUrl: window.location.href,
            jobTitle: info.jobTitle,
            company: info.company,
          },
        } as ExtensionMessage)
      }, 500)
    })
  })
}

// Initial check (catches pages where the form is already in the DOM)
refreshCache()
