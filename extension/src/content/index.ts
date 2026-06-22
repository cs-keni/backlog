import { extractPageInfo, detectLeetCodeProblem, detectAts } from './detect'
import { fillForm, applyFieldValues, fillWorkdayComboboxes, fillFileInputs } from './fill'
import { detectNextButton, detectPageType } from './detect'
import { scrapeHandshakeJob, installExternalApplyInterceptor } from './handshake'
import type { ExtensionMessage, FillResult, PageInfo, PageTypeInfo, JobContext } from '../shared/types'

// Guard: don't run sidebar injection or message handlers in iframes.
// navigation.ts patches pushState in all frames, but sidebar injection and
// chrome.runtime message listeners must only run in the top-level frame.
const IS_TOP_FRAME = window === window.top

// Cache detection result so the popup always gets the latest known state.
// Greenhouse and other ATS forms often render asynchronously via JS, so the
// form may not exist at document_idle. The MutationObserver below updates
// this cache the moment inputs appear.
let cachedPageInfo: PageInfo = { ats: null, jobTitle: null, company: null, jobDescription: null, isJobPage: false }
let submissionWatched = false

// ─── Handshake job scraping ───────────────────────────────────────────────────

function maybeInitHandshake(url: string) {
  if (!IS_TOP_FRAME) return
  if (detectAts(url) !== 'handshake') return

  // Scrape job data and push to background for sidebar consumption
  scrapeHandshakeJob().then((data) => {
    if (!data) return
    try {
      chrome.runtime.sendMessage({ type: 'SET_HANDSHAKE_JOB_DATA', payload: data } as ExtensionMessage)
    } catch { /* context invalidated */ }
  })
}

// Install the external-apply interceptor once on Handshake pages so we can
// capture the job data before the tab navigates to the company ATS.
if (IS_TOP_FRAME && detectAts(location.href) === 'handshake') {
  installExternalApplyInterceptor((data, sourceUrl) => {
    try {
      chrome.runtime.sendMessage({
        type: 'STORE_CROSS_PLATFORM_JOB_CONTEXT',
        payload: { ...data, sourceUrl },
      } as ExtensionMessage)
    } catch { /* context invalidated */ }
  })
}

// Initial scrape on page load
maybeInitHandshake(location.href)

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

if (IS_TOP_FRAME) {
  // Watch for dynamically injected forms (Greenhouse embed, SPA routing, etc.)
  try {
    const observer = new MutationObserver(() => {
      if (!cachedPageInfo.isJobPage) refreshCache()
    })
    if (document.body) observer.observe(document.body, { childList: true, subtree: true })
  } catch { /* ignore */ }
}

// ─── DSA auto-injection ───────────────────────────────────────────────────────

function tryInjectDsaPanel(url: string): void {
  if (!IS_TOP_FRAME) return
  const problem = detectLeetCodeProblem(url)
  if (!problem) return
  // Store DSA info so GET_PAGE_INFO returns it when sidebar.js initializes
  cachedPageInfo = {
    ats: null,
    jobTitle: null,
    company: null,
    jobDescription: null,
    isJobPage: false,
    dsaSlug: problem.lcSlug,
    dsaDifficulty: problem.difficulty,
  }
  // Ask background to inject sidebar.js — same mechanism as toolbar click
  try { chrome.runtime.sendMessage({ type: 'AUTO_INJECT_SIDEBAR' } as ExtensionMessage) } catch { /* context invalidated */ }
}

function tryUpdateDsaPanel(url: string): void {
  if (!IS_TOP_FRAME) return
  const problem = detectLeetCodeProblem(url)
  cachedPageInfo = {
    ats: null,
    jobTitle: null,
    company: null,
    jobDescription: null,
    isJobPage: false,
    dsaSlug: problem?.lcSlug,
    dsaDifficulty: problem?.difficulty,
  }
  // Notify already-injected sidebar.js of the navigation via DOM event
  window.dispatchEvent(new CustomEvent('backlog:dsa-update', { detail: cachedPageInfo }))
  // Also inject/reveal sidebar if this is a tracked problem and sidebar isn't open yet
  if (problem) {
    try { chrome.runtime.sendMessage({ type: 'AUTO_INJECT_SIDEBAR' } as ExtensionMessage) } catch { /* context invalidated */ }
  }
}

// ─── Navigation re-trigger ────────────────────────────────────────────────────
// Listen for the custom event dispatched by navigation.ts (world: MAIN).
// On SPA navigation, reset the detection cache and notify the background.
window.addEventListener('backlog:navigation', (e) => {
  if (!IS_TOP_FRAME) return
  const url = (e as CustomEvent<{ url: string }>).detail?.url ?? location.href
  submissionWatched = false
  cachedPageInfo = { ats: null, jobTitle: null, company: null, jobDescription: null, isJobPage: false }
  // Small delay to allow the new page DOM to settle
  setTimeout(() => {
    refreshCache()
    tryUpdateDsaPanel(url)
    maybeInitHandshake(url)
    try { chrome.runtime.sendMessage({ type: 'PAGE_NAVIGATED', payload: { url } } as ExtensionMessage) } catch { /* context invalidated */ }
  }, 300)
})

// ─── Message handler ──────────────────────────────────────────────────────────

if (IS_TOP_FRAME) chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
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
      const finishWithFiles = async () => {
        try {
          const contextResponse = await new Promise<{ jobContext?: JobContext | null }>((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_JOB_CONTEXT' }, (res) => resolve(res ?? { jobContext: null }))
          })
          const fileResult = await fillFileInputs(message.payload, contextResponse.jobContext ?? null)
          result.filled.push(...fileResult.filled)
          result.skipped.push(...fileResult.skipped)
        } catch { /* file upload is best-effort */ }
        sendResponse(result)
      }
      if (ats === 'workday') {
        fillWorkdayComboboxes(message.payload)
          .then((comboboxFilled) => {
            result.filled.push(...comboboxFilled)
            void finishWithFiles()
          })
          .catch(() => { void finishWithFiles() })
      } else {
        void finishWithFiles()
      }
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

  function send() {
    if (submitted) return
    submitted = true
    try {
      chrome.runtime.sendMessage({
        type: 'SUBMIT_ATTEMPTED',
        payload: {
          url: window.location.href,
          jobTitle: info.jobTitle,
          company: info.company,
          ats: info.ats,
        },
      } as ExtensionMessage)
    } catch { /* context invalidated */ }
  }

  // Form submit events are safe to watch on any detected page
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', send)
  })

  // Button click listeners cause too many false positives on generic-detected pages
  // (login pages, search forms, auth flows). Only attach them on confirmed ATS pages
  // where we have high confidence this is actually a job application.
  if (info.ats !== null && info.ats !== 'generic') {
    document.querySelectorAll('button[type="submit"], input[type="submit"]').forEach((btn) => {
      btn.addEventListener('click', () => setTimeout(send, 500))
    })
  }
}

// Initial check (catches pages where the form is already in the DOM)
if (IS_TOP_FRAME) {
  refreshCache()
  tryInjectDsaPanel(window.location.href)
}
