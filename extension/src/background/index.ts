import { markApplied, addJob, analyzePage, answerQuestion } from '../shared/api'
import type { ExtensionMessage, TabSessionState, PageFill, FillResult, FieldAnalysisResult } from '../shared/types'

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

// ─── Message handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === 'MARK_APPLIED') {
    const { jobUrl, jobTitle, company } = message.payload
    markApplied({ jobUrl, jobTitle, company })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }))
    return true
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
})

// ─── Tab lifecycle ────────────────────────────────────────────────────────────

// Clean up session state when a tab is closed to prevent state bleed
chrome.tabs.onRemoved.addListener((tabId) => {
  void clearTabState(tabId)
})

// Trigger auto-advance fill on full-page navigation (non-SPA)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return
  getTabState(tabId).then((state) => {
    if (state?.autoAdvance && state.profile) {
      setTimeout(() => { void fillTabPage(tabId) }, 1000)
    }
  }).catch(() => {})
})

// Keep the service worker alive during active sessions
void chrome.storage.session.get('_keepalive')
