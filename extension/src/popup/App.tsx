import { useState, useEffect, useCallback } from 'react'
import { getApiKey, setApiKey, clearApiKey, fetchProfile, addJob, analyzePage, answerQuestion } from '../shared/api'
import { BACKLOG_URL } from '../shared/config'
import type {
  FullProfile, PageInfo, FilledField, SkippedField, FillResult,
  ExtensionMessage, PageFill, TabSessionState, FieldAnalysisResult,
} from '../shared/types'

// ─── State machine ────────────────────────────────────────────────────────────

type FillStage = 'tier1' | 'tier2' | 'answering'

type AppState =
  | { status: 'loading' }
  | { status: 'no-key' }
  | { status: 'ready'; profile: FullProfile; page: PageInfo; tabId: number }
  | { status: 'filling'; stage: FillStage }
  | { status: 'review'; filled: FilledField[]; skipped: SkippedField[]; page: PageInfo; profile: FullProfile; tabId: number; aiUnavailable: boolean }
  | { status: 'multi-review'; pages: PageFill[]; tabId: number; profile: FullProfile }
  | { status: 'added'; duplicate: boolean }
  | { status: 'error'; message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ATS_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  workday: 'Workday',
  generic: 'Job page',
}

const STAGE_LABELS: Record<FillStage, string> = {
  tier1: 'Filling standard fields…',
  tier2: 'Enhancing with AI…',
  answering: 'Drafting open-ended answers…',
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab ?? null
}

async function sendToContent<T>(tabId: number, message: ExtensionMessage, frameId = 0): Promise<T | null> {
  try {
    return await chrome.tabs.sendMessage(tabId, message, { frameId }) as T
  } catch {
    return null
  }
}

async function getTabState(tabId: number): Promise<TabSessionState | null> {
  const key = `tab_${tabId}`
  const result = await chrome.storage.session.get(key)
  return (result[key] as TabSessionState | undefined) ?? null
}

async function setTabState(tabId: number, state: TabSessionState): Promise<void> {
  await chrome.storage.session.set({ [`tab_${tabId}`]: state })
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const [state, setState] = useState<AppState>({ status: 'loading' })
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(false)

  const init = useCallback(async () => {
    const key = await getApiKey()
    if (!key) { setState({ status: 'no-key' }); return }

    try {
      const tab = await getActiveTab()
      const tabId = tab?.id ?? 0

      // Check if there's an existing multi-page session state for this tab
      if (tabId) {
        const sessionState = await getTabState(tabId)
        if (sessionState && sessionState.pages.length > 1 && sessionState.profile) {
          setState({ status: 'multi-review', pages: sessionState.pages, tabId, profile: sessionState.profile })
          return
        }
      }

      const [profile, page] = await Promise.all([
        fetchProfile(),
        tabId ? sendToContent<PageInfo>(tabId, { type: 'GET_PAGE_INFO' }) : Promise.resolve(null),
      ])
      setState({
        status: 'ready',
        profile,
        tabId,
        page: page ?? { ats: null, jobTitle: null, company: null, jobDescription: null, isJobPage: false },
      })
    } catch {
      setState({ status: 'error', message: 'Could not connect to Backlog. Check your API key in Settings.' })
    }
  }, [])

  useEffect(() => { void init() }, [init])

  // Auto-retry page detection when not on a job page (handles async-rendered forms)
  useEffect(() => {
    const isReadyNoJob = state.status === 'ready' && !state.page.isJobPage
    if (!isReadyNoJob) return
    let cancelled = false
    let attempts = 0
    const poll = async () => {
      if (cancelled || attempts >= 4 || state.status !== 'ready') return
      attempts++
      const page = await sendToContent<PageInfo>(state.tabId, { type: 'GET_PAGE_INFO' })
      if (cancelled) return
      if (page?.isJobPage) {
        setState(s => s.status === 'ready' ? { ...s, page } : s)
      } else {
        setTimeout(poll, 2500)
      }
    }
    const t = setTimeout(poll, 1500)
    return () => { cancelled = true; clearTimeout(t) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.status === 'ready' ? state.page.isJobPage : null])

  async function saveKey() {
    if (!apiKeyInput.startsWith('blg_')) {
      setState({ status: 'error', message: 'Invalid key format. Keys start with blg_' })
      return
    }
    setSaving(true)
    await setApiKey(apiKeyInput.trim())
    setSaving(false)
    setApiKeyInput('')
    await init()
  }

  async function autoFill() {
    if (state.status !== 'ready') return
    const { tabId, profile, page } = state

    setState({ status: 'filling', stage: 'tier1' })

    // ── Tier 1: deterministic fill ─────────────────────────────────────────
    let result = await sendToContent<FillResult>(tabId, { type: 'FILL_FORM_TIER1', payload: profile })

    // If main frame filled nothing, try cross-origin iframes (Greenhouse/Lever embeds)
    if (result && result.filled.length === 0) {
      try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId }) ?? []
        for (const frame of frames) {
          if (frame.frameId === 0) continue
          try {
            const frameResult = await chrome.tabs.sendMessage(
              tabId,
              { type: 'FILL_FORM_TIER1', payload: profile },
              { frameId: frame.frameId }
            ) as FillResult | null
            if (frameResult && frameResult.filled.length > 0) {
              result = frameResult
              break
            }
          } catch { continue }
        }
      } catch { /* webNavigation unavailable */ }
    }

    if (!result) {
      setState({ status: 'error', message: 'Could not reach the page. Try refreshing.' })
      return
    }

    let aiUnavailable = false
    const allFilled = [...result.filled]

    // ── Tier 2: Haiku analysis for unfilled fields ─────────────────────────
    if (result.unfilledFields.length > 0) {
      setState({ status: 'filling', stage: 'tier2' })
      try {
        const analysisResults = await Promise.race([
          analyzePage(result.unfilledFields),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]) as Awaited<ReturnType<typeof analyzePage>>

        // Apply profile-value fills immediately
        const profileFills = analysisResults.filter(
          (r): r is Extract<FieldAnalysisResult, { type: 'value' }> => r.type === 'value'
        )
        if (profileFills.length > 0) {
          const tier2Result = await sendToContent<{ filled: FilledField[] }>(tabId, {
            type: 'FILL_FORM_TIER2',
            payload: { fields: profileFills.map(r => ({ selector: r.selector, value: r.value })) },
          })
          if (tier2Result) allFilled.push(...tier2Result.filled)
        }

        // Open-ended: call Sonnet per question
        const openEndedFills = analysisResults.filter(
          (r): r is Extract<FieldAnalysisResult, { type: 'open_ended' }> => r.type === 'open_ended'
        )
        if (openEndedFills.length > 0) {
          setState({ status: 'filling', stage: 'answering' })
          const answers = await Promise.allSettled(
            openEndedFills.map(async (f) => {
              const answer = await answerQuestion(f.question)
              return answer ? { selector: f.selector, value: answer } : null
            })
          )
          const validAnswers = answers
            .filter((r): r is PromiseFulfilledResult<{ selector: string; value: string }> =>
              r.status === 'fulfilled' && r.value !== null
            )
            .map(r => r.value)

          if (validAnswers.length > 0) {
            const openResult = await sendToContent<{ filled: FilledField[] }>(tabId, {
              type: 'FILL_FORM_TIER2',
              payload: { fields: validAnswers },
            })
            if (openResult) allFilled.push(...openResult.filled)
          }
        }
      } catch {
        // Haiku/Sonnet unavailable — continue with Tier 1 results only
        aiUnavailable = true
      }
    }

    // Persist page fill to session state
    const pageFill: PageFill = {
      url: page.jobTitle ? `${page.company ?? ''} — ${page.jobTitle}` : location.href,
      pageIndex: 0,
      filled: allFilled,
    }

    const currentSession = await getTabState(tabId)
    const newSession: TabSessionState = {
      autoAdvance,
      profile,
      pages: [...(currentSession?.pages ?? []), pageFill],
      currentPageIndex: currentSession ? currentSession.currentPageIndex + 1 : 0,
    }
    await setTabState(tabId, newSession)

    // Auto-advance: click Next if enabled
    if (autoAdvance) {
      const pageType = await sendToContent<{ hasNextButton: boolean }>(tabId, { type: 'DETECT_PAGE_TYPE' })
      if (pageType?.hasNextButton) {
        await sendToContent(tabId, { type: 'CLICK_NEXT_BUTTON' })
        // The background will handle the next page via tabs.onUpdated / PAGE_NAVIGATED
        setState({
          status: 'review',
          filled: allFilled,
          skipped: result.skipped,
          page,
          profile,
          tabId,
          aiUnavailable,
        })
        return
      }
    }

    setState({
      status: 'review',
      filled: allFilled,
      skipped: result.skipped,
      page,
      profile,
      tabId,
      aiUnavailable,
    })
  }

  async function handleAddToBacklog() {
    if (state.status !== 'ready') return
    const { page, tabId } = state
    const tab = await getActiveTab()
    if (!tab?.url) return

    try {
      const result = await addJob({
        url: tab.url,
        title: page.jobTitle ?? tab.title ?? 'Unknown role',
        company: page.company ?? 'Unknown company',
        description: page.jobDescription,
      })
      setState({ status: 'added', duplicate: result.duplicate })
    } catch {
      setState({ status: 'error', message: 'Failed to add job. Make sure you\'re on a job posting page.' })
    }
  }

  async function viewMultiPageReview() {
    if (state.status !== 'ready') return
    const sessionState = await getTabState(state.tabId)
    if (sessionState && sessionState.pages.length > 0) {
      setState({ status: 'multi-review', pages: sessionState.pages, tabId: state.tabId, profile: state.profile })
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-[200px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="text-sm font-semibold text-zinc-100">Backlog</span>
        {state.status !== 'no-key' && state.status !== 'loading' && (
          <button
            onClick={async () => { await clearApiKey(); setState({ status: 'no-key' }) }}
            className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      <div className="flex-1 p-4">
        {state.status === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}

        {state.status === 'no-key' && (
          <SetupScreen
            value={apiKeyInput}
            onChange={setApiKeyInput}
            onSave={saveKey}
            saving={saving}
          />
        )}

        {state.status === 'ready' && (
          <ReadyScreen
            profile={state.profile}
            page={state.page}
            autoAdvance={autoAdvance}
            onAutoAdvanceChange={setAutoAdvance}
            onAutoFill={autoFill}
            onAddToBacklog={handleAddToBacklog}
            onViewHistory={viewMultiPageReview}
            onRetry={async () => {
              const page = await sendToContent<PageInfo>(state.tabId, { type: 'GET_PAGE_INFO' })
              if (page) setState(s => s.status === 'ready' ? { ...s, page } : s)
            }}
          />
        )}

        {state.status === 'filling' && (
          <FillingScreen stage={state.stage} />
        )}

        {state.status === 'review' && (
          <ReviewScreen
            filled={state.filled}
            skipped={state.skipped}
            aiUnavailable={state.aiUnavailable}
            onDone={() => setState({ status: 'ready', profile: state.profile, page: state.page, tabId: state.tabId })}
          />
        )}

        {state.status === 'multi-review' && (
          <MultiPageReviewScreen
            pages={state.pages}
            onDone={() => setState({ status: 'ready', profile: state.profile, page: { ats: null, jobTitle: null, company: null, jobDescription: null, isJobPage: false }, tabId: state.tabId })}
          />
        )}

        {state.status === 'added' && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="text-2xl">{state.duplicate ? '📋' : '✅'}</div>
            <p className="text-sm text-zinc-200 font-medium">
              {state.duplicate ? 'Already in Backlog' : 'Added to Backlog!'}
            </p>
            <p className="text-xs text-zinc-500">
              {state.duplicate ? 'This job is already in your feed.' : 'Open Backlog to view and apply.'}
            </p>
            <a
              href={BACKLOG_URL + '/feed'}
              target="_blank"
              rel="noreferrer"
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Open Backlog →
            </a>
          </div>
        )}

        {state.status === 'error' && (
          <div className="space-y-3 py-4">
            <p className="text-xs text-red-400">{state.message}</p>
            <button
              onClick={() => { setState({ status: 'loading' }); void init() }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Setup screen ─────────────────────────────────────────────────────────────

function SetupScreen({
  value, onChange, onSave, saving,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-zinc-200 font-medium">Connect to Backlog</p>
        <p className="text-xs text-zinc-500 mt-1">
          Paste your API key from{' '}
          <a href={BACKLOG_URL + '/settings'} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
            Backlog Settings
          </a>
          .
        </p>
      </div>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void onSave() }}
        placeholder="blg_••••••••••••••••••••"
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
        autoFocus
      />
      <button
        onClick={onSave}
        disabled={saving || !value}
        className="w-full py-2 rounded-lg bg-zinc-100 text-zinc-900 text-xs font-medium hover:bg-white transition-colors disabled:opacity-40"
      >
        {saving ? 'Connecting…' : 'Connect'}
      </button>
    </div>
  )
}

// ─── Ready screen ─────────────────────────────────────────────────────────────

function ReadyScreen({
  profile, page, autoAdvance, onAutoAdvanceChange, onAutoFill, onAddToBacklog, onViewHistory, onRetry,
}: {
  profile: FullProfile
  page: PageInfo
  autoAdvance: boolean
  onAutoAdvanceChange: (v: boolean) => void
  onAutoFill: () => void
  onAddToBacklog: () => void
  onViewHistory: () => void
  onRetry: () => void
}) {
  const userName = profile.user.full_name ?? profile.user.email ?? 'Account linked'

  return (
    <div className="space-y-4">
      {/* Job info */}
      {page.isJobPage && page.ats && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-[11px] text-zinc-400 font-medium">{ATS_LABELS[page.ats] ?? page.ats}</span>
          </div>
          {page.jobTitle && (
            <p className="text-xs text-zinc-200 font-medium truncate">{page.jobTitle}</p>
          )}
          {page.company && (
            <p className="text-[11px] text-zinc-500 truncate">{page.company}</p>
          )}
        </div>
      )}

      {!page.isJobPage && (
        <div className="flex items-center justify-between py-2">
          <p className="text-xs text-zinc-500">
            Navigate to a job application page to use auto-fill.
          </p>
          <button
            onClick={onRetry}
            className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors underline shrink-0 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {page.isJobPage && (
          <>
            <button
              onClick={onAutoFill}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
            >
              Auto-fill form
            </button>
            {/* Auto-advance toggle */}
            <label className="flex items-center gap-2 cursor-pointer px-1 py-0.5">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => onAutoAdvanceChange(e.target.checked)}
                className="accent-indigo-500 w-3 h-3"
              />
              <span className="text-[11px] text-zinc-500">
                Auto-advance (click Next after each page)
              </span>
            </label>
          </>
        )}
        <button
          onClick={onAddToBacklog}
          disabled={!page.isJobPage}
          className="w-full py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add to Backlog
        </button>
        <button
          onClick={onViewHistory}
          className="w-full py-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          View fill history for this tab
        </button>
      </div>

      {/* Footer */}
      <p className="text-[11px] text-zinc-600 truncate">
        {userName}
      </p>
    </div>
  )
}

// ─── Filling screen ───────────────────────────────────────────────────────────

function FillingScreen({ stage }: { stage: FillStage }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="w-4 h-4 border-2 border-zinc-600 border-t-indigo-400 rounded-full animate-spin" />
      <p className="text-xs text-zinc-500">{STAGE_LABELS[stage]}</p>
      {stage === 'tier2' && (
        <p className="text-[10px] text-zinc-700 text-center max-w-[200px]">
          Analyzing fields that couldn&apos;t be matched automatically…
        </p>
      )}
    </div>
  )
}

// ─── Review screen ────────────────────────────────────────────────────────────

function ReviewScreen({
  filled, skipped, aiUnavailable, onDone,
}: {
  filled: FilledField[]
  skipped: SkippedField[]
  aiUnavailable: boolean
  onDone: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-200">
          Filled {filled.length} field{filled.length !== 1 ? 's' : ''}
        </p>
        <button onClick={onDone} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          ← Back
        </button>
      </div>

      {/* AI unavailable note */}
      {aiUnavailable && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <p className="text-[11px] text-zinc-500">
            AI analysis unavailable — filled with profile data only.
          </p>
        </div>
      )}

      {/* Filled fields */}
      {filled.length > 0 && (
        <div className="space-y-1 max-h-52 overflow-y-auto">
          {filled.map((f, i) => (
            <div key={i} className="flex items-start gap-2 py-1">
              <span className="text-emerald-500 text-[11px] mt-0.5 shrink-0">✓</span>
              <div className="min-w-0">
                <span className="text-[11px] text-zinc-400">{f.label}: </span>
                <span className="text-[11px] text-zinc-200 break-all">{f.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skipped / manual fields */}
      {skipped.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-1.5">
          <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide">Needs manual input</p>
          {skipped.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-zinc-600 text-[11px] mt-0.5 shrink-0">○</span>
              <div>
                <span className="text-[11px] text-zinc-400">{f.label}: </span>
                <span className="text-[11px] text-zinc-600">{f.reason}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-zinc-600">
        Review the form, then click the site&apos;s Submit button when ready.
      </p>
    </div>
  )
}

// ─── Multi-page review screen ─────────────────────────────────────────────────

function MultiPageReviewScreen({
  pages, onDone,
}: {
  pages: PageFill[]
  onDone: () => void
}) {
  const totalFilled = pages.reduce((sum, p) => sum + p.filled.length, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-200">
          {pages.length} page{pages.length !== 1 ? 's' : ''} · {totalFilled} fields filled
        </p>
        <button onClick={onDone} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          ← Back
        </button>
      </div>

      <div className="space-y-4 max-h-64 overflow-y-auto">
        {pages.map((page, pageIdx) => (
          <div key={pageIdx} className="space-y-1.5">
            {/* Page header */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
                Page {page.pageIndex + 1}
              </span>
              {page.url && (
                <span className="text-[10px] text-zinc-700 truncate max-w-[160px]">{page.url}</span>
              )}
            </div>
            {/* Fields */}
            {page.filled.length === 0 ? (
              <p className="text-[11px] text-zinc-600 pl-1">No fields filled on this page.</p>
            ) : (
              page.filled.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 text-[11px] mt-0.5 shrink-0">✓</span>
                  <div className="min-w-0">
                    <span className="text-[11px] text-zinc-400">{f.label}: </span>
                    <span className="text-[11px] text-zinc-200 break-all">{f.value}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-zinc-600">
        Review all filled values, then click the site&apos;s Submit button when ready.
      </p>
    </div>
  )
}
