import { BACKLOG_URL } from '../shared/config'
import { markApplied, addJob, analyzePage, answerQuestion, getApiKey, fetchJobContext } from '../shared/api'
import type { ExtensionMessage, TabSessionState, PageFill, FillResult, FieldAnalysisResult, JobContext } from '../shared/types'
import { isGenericPostSubmitPage, isPostSubmitConfirmationUrl } from '../shared/postSubmit'

// ─── Session state helpers ────────────────────────────────────────────────────
// chrome.storage.session persists for the entire browser session (not per-tab).
// We key by tabId so each tab gets independent state.

function sessionKey(tabId: number): string {
  return `tab_${tabId}`
}

async function getTabState(tabId: number): Promise<TabSessionState | null> {
  const result = await chrome.storage.session.get(sessionKey(tabId))
  return (result[sessionKey(tabId)] as TabSessionState | undefined) ?? null
}

async function setTabState(tabId: number, state: TabSessionState): Promise<void> {
  await chrome.storage.session.set({ [sessionKey(tabId)]: state })
}

async function clearTabState(tabId: number): Promise<void> {
  await chrome.storage.session.remove(sessionKey(tabId))
}

async function updateTabState(tabId: number, patch: Partial<TabSessionState>): Promise<TabSessionState> {
  const current = await getTabState(tabId)
  const next: TabSessionState = {
    autoAdvance: current?.autoAdvance ?? false,
    profile: current?.profile ?? null,
    pages: current?.pages ?? [],
    currentPageIndex: current?.currentPageIndex ?? -1,
    jobContext: current?.jobContext ?? null,
    pendingSubmission: current?.pendingSubmission ?? null,
    ...patch,
  }
  await setTabState(tabId, next)
  return next
}

// ─── Orchestrated fill (Tier 1 + Tier 2) ─────────────────────────────────────
// Used by auto-advance: after the user clicks Next and the new page loads,
// the background fills it automatically without the popup being open.

async function fillTabPage(tabId: number): Promise<void> {
  const state = await getTabState(tabId)
  if (!state?.profile || !state.autoAdvance) return

  // Tier 1: deterministic fill
  let tier1Result: FillResult | null = null
  try {
    tier1Result = await chrome.tabs.sendMessage(tabId, {
      type: 'FILL_FORM_TIER1',
      payload: state.profile,
    }) as FillResult | null
  } catch {
    return // Content script not ready on this page
  }

  if (!tier1Result) return

  const pageFill: PageFill = {
    url: (await chrome.tabs.get(tabId)).url ?? '',
    pageIndex: state.currentPageIndex + 1,
    filled: [...tier1Result.filled],
  }

  // Tier 2: Haiku analysis for unfilled fields (5s timeout via Promise.race in analyzePage)
  if (tier1Result.unfilledFields.length > 0) {
    try {
      const analysisResults = await Promise.race([
        analyzePage(tier1Result.unfilledFields),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]) as Awaited<ReturnType<typeof analyzePage>>

      const profileFills = (analysisResults as FieldAnalysisResult[]).filter(
        (r): r is Extract<FieldAnalysisResult, { type: 'value' }> => r.type === 'value'
      )
      if (profileFills.length > 0) {
        const tier2Result = await chrome.tabs.sendMessage(tabId, {
          type: 'FILL_FORM_TIER2',
          payload: { fields: profileFills.map(r => ({ selector: r.selector, value: r.value })) },
        }) as { filled: FillResult['filled'] } | null
        if (tier2Result) pageFill.filled.push(...tier2Result.filled)
      }

      // Open-ended: call Sonnet per field (best-effort, fire-and-forget)
      const openEndedFills = (analysisResults as FieldAnalysisResult[]).filter(
        (r): r is Extract<FieldAnalysisResult, { type: 'open_ended' }> => r.type === 'open_ended'
      )
      await Promise.allSettled(openEndedFills.map(async (f) => {
        const answer = await answerQuestion(f.question)
        if (answer) {
          const applyResult = await chrome.tabs.sendMessage(tabId, {
            type: 'FILL_FORM_TIER2',
            payload: { fields: [{ selector: f.selector, value: answer }] },
          }) as { filled: FillResult['filled'] } | null
          if (applyResult) pageFill.filled.push(...applyResult.filled)
        }
      }))
    } catch { /* timeout or API error — Tier 1 fills are still persisted */ }
  }

  // Update session state
  await setTabState(tabId, {
    ...state,
    currentPageIndex: pageFill.pageIndex,
    pages: [...state.pages, pageFill],
  })
}

// ─── Initiate from Backlog / file proxy / submit confirmation ────────────────

function stripBacklogJobId(rawUrl: string): string {
  const clean = new URL(rawUrl)
  clean.searchParams.delete('backlog_job_id')
  return clean.toString()
}

async function storeInitiatedJob(tabId: number, rawUrl: string): Promise<void> {
  const url = new URL(rawUrl)
  const jobId = url.searchParams.get('backlog_job_id')
  if (!jobId) return

  let context: JobContext = {
    jobId,
    jobTitle: 'Unknown role',
    jobCompany: 'Unknown company',
    applicationId: null,
  }

  try {
    const job = await fetchJobContext(jobId)
    context = {
      jobId: job.id,
      jobTitle: job.title,
      jobCompany: job.company,
      applicationId: job.applications?.[0]?.id ?? null,
    }
  } catch (err) {
    console.warn('[Backlog] Could not fetch initiated job context:', err)
  }

  await updateTabState(tabId, { jobContext: context })

  const cleanUrl = stripBacklogJobId(rawUrl)
  if (cleanUrl !== rawUrl) {
    try { await chrome.tabs.update(tabId, { url: cleanUrl }) } catch { /* tab may have moved on */ }
  }
}

async function fetchFile(url: string): Promise<ArrayBuffer> {
  const headers: Record<string, string> = {}
  if (url.startsWith(BACKLOG_URL)) {
    const key = await getApiKey()
    if (key) headers.Authorization = `Bearer ${key}`
  }

  const res = await fetch(url, { credentials: 'omit', headers })
  if (!res.ok) throw new Error(`File fetch failed: ${res.status}`)
  return res.arrayBuffer()
}

export async function handleFetchFileMessage(
  message: Extract<ExtensionMessage, { type: 'FETCH_FILE' }>
): Promise<{ ok: true; buffer: ArrayBuffer } | { ok: false; error: string }> {
  try {
    if (!message.url || !/^https?:\/\//i.test(message.url)) {
      throw new Error('Invalid file URL')
    }
    const buffer = await fetchFile(message.url)
    return { ok: true, buffer }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function pageHasForm(tabId: number): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.querySelector('form') !== null,
  })
  return Boolean(results[0]?.result)
}

async function markTabApplied(tabId: number, url: string): Promise<void> {
  const state = await getTabState(tabId)
  const pending = state?.pendingSubmission
  if (!pending) return

  await markApplied({
    jobUrl: url,
    jobTitle: state.jobContext?.jobTitle ?? pending.jobTitle,
    company: state.jobContext?.jobCompany ?? pending.company,
    jobId: state.jobContext?.jobId,
    applicationId: state.jobContext?.applicationId,
  })

  await updateTabState(tabId, { pendingSubmission: null })
}

async function maybeDetectSubmitted(tabId: number, url: string): Promise<void> {
  const state = await getTabState(tabId)
  const pending = state?.pendingSubmission
  if (!pending) return

  if (Date.now() - pending.submittedAt > 5 * 60 * 1000) {
    await updateTabState(tabId, { pendingSubmission: null })
    return
  }

  if (isPostSubmitConfirmationUrl(url, pending.ats)) {
    await markTabApplied(tabId, url)
    return
  }

  if (pending.ats === 'generic') {
    setTimeout(() => {
      pageHasForm(tabId)
        .then((hasForm) => {
          if (isGenericPostSubmitPage(hasForm)) return markTabApplied(tabId, url)
        })
        .catch(() => {})
    }, 500)
  }
}

// ─── Message handlers ─────────────────────────────────────────────────────────

// ─── Toolbar click → toggle sidebar ──────────────────────────────────────────
// First try to toggle an existing sidebar; if it's not there yet, inject sidebar.js.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const host = document.getElementById('backlog-sidebar-host')
        if (!host?.shadowRoot) return false
        const inner = host.shadowRoot.getElementById('backlog-sidebar-inner')
        if (!inner) return false
        inner.style.display = inner.style.display === 'none' ? '' : 'none'
        return true
      },
    })
    if (!results[0]?.result) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['sidebar.js'] })
    }
  } catch (err) {
    console.error('[Backlog] Sidebar injection failed:', err)
  }
})

// ─── Message handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === 'GET_TAB_ID') {
    sendResponse({ tabId: sender.tab?.id ?? 0 })
    return true
  }

  if (message.type === 'GET_JOB_CONTEXT') {
    const tabId = sender.tab?.id
    if (!tabId) {
      sendResponse({ jobContext: null })
      return true
    }
    getTabState(tabId)
      .then((state) => sendResponse({ jobContext: state?.jobContext ?? null }))
      .catch(() => sendResponse({ jobContext: null }))
    return true
  }

  if (message.type === 'FETCH_FILE') {
    handleFetchFileMessage(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err) }))
    return true
  }

  if (message.type === 'MARK_APPLIED') {
    const { jobUrl, jobTitle, company, jobId, applicationId } = message.payload
    markApplied({ jobUrl, jobTitle, company, jobId, applicationId })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }))
    return true
  }

  if (message.type === 'SUBMIT_ATTEMPTED') {
    const tabId = sender.tab?.id
    if (!tabId) return false
    updateTabState(tabId, {
      pendingSubmission: {
        url: message.payload.url,
        jobTitle: message.payload.jobTitle,
        company: message.payload.company,
        ats: message.payload.ats,
        submittedAt: Date.now(),
      },
    }).catch(() => {})
    return false
  }

  if (message.type === 'ADD_TO_BACKLOG') {
    const { url, title, company, description } = message.payload
    addJob({ url, title, company, description })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }))
    return true
  }

  if (message.type === 'PAGE_NAVIGATED') {
    // Content script notifies us of SPA navigation — trigger auto-advance fill
    const tabId = sender.tab?.id
    if (tabId) {
      // Small delay to let the new page DOM settle before filling
      setTimeout(() => { void fillTabPage(tabId) }, 800)
    }
    return false
  }

  if (message.type === 'AUTO_INJECT_SIDEBAR') {
    const tabId = sender.tab?.id
    if (!tabId) return false
    // If sidebar already exists, show it (in case it was collapsed); otherwise inject
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const host = document.getElementById('backlog-sidebar-host')
        if (!host?.shadowRoot) return false
        const inner = host.shadowRoot.getElementById('backlog-sidebar-inner')
        if (!inner) return false
        if (inner.style.display === 'none') inner.style.display = ''
        return true
      },
    }).then((results) => {
      if (!results[0]?.result) {
        return chrome.scripting.executeScript({ target: { tabId }, files: ['sidebar.js'] })
      }
    }).catch(() => {})
    return false
  }
})

// ─── DSA attempt flush ────────────────────────────────────────────────────────
// On tab close, read any pending DSA attempt from chrome.storage.local and POST it.
// chrome.storage.local persists across service worker restarts, so this is reliable.

async function flushDsaAttempt(tabId: number): Promise<void> {
  const key = `dsa_attempt_${tabId}`
  try {
    const result = await chrome.storage.local.get(key)
    const attempt = result[key]
    if (!attempt) return

    const apiKey = await getApiKey()
    if (apiKey) {
      await fetch(`${BACKLOG_URL}/api/dsa/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(attempt),
      })
    }
  } catch { /* best-effort */ } finally {
    try { await chrome.storage.local.remove(`dsa_attempt_${tabId}`) } catch { /* ignore */ }
  }
}

// ─── Tab lifecycle ────────────────────────────────────────────────────────────

// Clean up session state when a tab is closed to prevent state bleed
chrome.tabs.onRemoved.addListener((tabId) => {
  void clearTabState(tabId)
  void flushDsaAttempt(tabId)
})

// Trigger auto-advance fill on full-page navigation (non-SPA)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url?.includes('backlog_job_id=')) {
    void storeInitiatedJob(tabId, changeInfo.url)
  }

  if (changeInfo.url) {
    void maybeDetectSubmitted(tabId, changeInfo.url)
  }

  if (changeInfo.status !== 'complete') return
  getTabState(tabId).then((state) => {
    const currentUrlPromise = chrome.tabs.get(tabId).then((tab) => tab.url ?? changeInfo.url ?? '')
    currentUrlPromise.then((url) => { void maybeDetectSubmitted(tabId, url) }).catch(() => {})
    if (state?.autoAdvance && state.profile) {
      setTimeout(() => { void fillTabPage(tabId) }, 1000)
    }
  }).catch(() => {})
})

// Keep the service worker alive during active sessions
void chrome.storage.session.get('_keepalive')
