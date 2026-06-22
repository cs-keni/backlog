import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getApiKey, setApiKey, fetchProfile, analyzePage, answerQuestion, improveSkills, addJob,
} from '../shared/api'
import { DsaCompanion } from './DsaCompanion'
import { HandshakePanel } from './HandshakePanel'
import { computeFills, applyFills, applyFieldValues, getLabelForInput, fillWorkdayComboboxes, fillFileInputs } from '../content/fill'
import { detectNextButton, detectPageType } from '../content/detect'
import type {
  FullProfile, PageInfo, FilledField, SkippedField,
  FieldAnalysisResult, PageFill, TabSessionState, ScannedField, JobContext,
} from '../shared/types'
import { BACKLOG_URL } from '../shared/config'
import { FillingState, type FillStage } from './FillingState'
import { ScanPreviewState } from './ScanPreview'
import { ReviewState } from './ReviewState'
import { ErrorState, type DebugExport, type DebugField } from './ErrorState'

// ─── Types ────────────────────────────────────────────────────────────────────

type SidebarState =
  | { status: 'loading' }
  | { status: 'no-key' }
  | { status: 'ready'; profile: FullProfile; page: PageInfo }
  | { status: 'scanning' }
  | { status: 'scan-preview'; fields: ScannedField[]; profile: FullProfile; page: PageInfo }
  | { status: 'filling'; stage: FillStage }
  | { status: 'review'; filled: FilledField[]; skipped: SkippedField[]; page: PageInfo; profile: FullProfile; aiUnavailable: boolean }
  | { status: 'added'; duplicate: boolean }
  | { status: 'error'; message: string }

const ATS_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  workday: 'Workday',
  handshake: 'Handshake',
  generic: 'Job page',
}

// ─── Session helpers ──────────────────────────────────────────────────────────

async function getTabId(): Promise<number> {
  return new Promise<number>((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, (res: { tabId?: number } | undefined) => {
        if (chrome.runtime.lastError) { resolve(0); return }
        resolve(res?.tabId ?? 0)
      })
    } catch {
      resolve(0)
    }
  })
}

async function getTabState(tabId: number): Promise<TabSessionState | null> {
  if (!tabId) return null
  const key = `tab_${tabId}`
  const result = await chrome.storage.session.get(key)
  return (result[key] as TabSessionState | undefined) ?? null
}

async function setTabState(tabId: number, state: TabSessionState): Promise<void> {
  if (!tabId) return
  await chrome.storage.session.set({ [`tab_${tabId}`]: state })
}

// ─── Skills field detection ───────────────────────────────────────────────────

interface SkillsField {
  el: HTMLInputElement | HTMLTextAreaElement
  selector: string
  currentValue: string
}

function findSkillsField(): SkillsField | null {
  const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[type="text"], textarea'
  )
  for (const input of inputs) {
    const label = getLabelForInput(input)
    if (/\bskills?\b/i.test(label)) {
      const selector = input.id
        ? `#${CSS.escape(input.id)}`
        : input.getAttribute('name')
          ? `[name="${input.getAttribute('name')}"]`
          : null
      if (!selector) continue
      return { el: input, selector, currentValue: input.value }
    }
  }
  return null
}

function buildDebugExport(
  page: PageInfo,
  pageIndex: number,
  scanned: ScannedField[],
  filled: FilledField[],
  skipped: SkippedField[],
  error?: string
): DebugExport {
  const filledSelectors = new Set(filled.map((f) => f.selector).filter(Boolean))
  const filledLabels = new Set(filled.map((f) => f.label.toLowerCase()))
  const fields: DebugField[] = scanned.map((field) => ({
    selector: field.selector,
    label: field.label,
    fillResult: filledSelectors.has(field.selector) || filledLabels.has(field.label.toLowerCase())
      ? '[FILLED]'
      : '[SKIPPED]',
  }))

  for (const item of skipped) {
    fields.push({
      selector: '',
      label: item.label,
      fillResult: `[SKIPPED: ${item.reason}]`,
    })
  }

  return {
    ats: page.ats,
    pageIndex,
    pageUrl: location.href,
    fields,
    ...(error ? { error } : {}),
  }
}

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar({ initialPage }: { initialPage: PageInfo }) {
  const [state, setState] = useState<SidebarState>({ status: 'loading' })
  const [collapsed, setCollapsed] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [skillsField, setSkillsField] = useState<SkillsField | null>(null)
  const [improvingSkills, setImprovingSkills] = useState(false)
  const [page, setPage] = useState<PageInfo>(initialPage)
  const [jobContext, setJobContext] = useState<JobContext | null>(null)
  const [tabId, setTabId] = useState<number>(0)
  const tabIdRef = useRef<number>(0)
  const cancelledRef = useRef(false)
  const lastProfileRef = useRef<FullProfile | null>(null)
  const lastScannedRef = useRef<ScannedField[]>([])
  const lastDebugRef = useRef<DebugExport | null>(null)

  // Restore saved theme
  useEffect(() => {
    chrome.storage.local.get('backlog_theme', (r) => {
      const saved = r.backlog_theme as 'light' | 'dark' | undefined
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    })
  }, [])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    chrome.storage.local.set({ backlog_theme: next })
  }

  const init = useCallback(async () => {
    try {
      const key = await getApiKey()
      if (!key) { setState({ status: 'no-key' }); return }

      // Tab state uses chrome.storage.session which can throw in partially-sandboxed
      // contexts (e.g. Workday iframes after extension reload). Treat as non-fatal.
      try {
        tabIdRef.current = await getTabId()
        setTabId(tabIdRef.current)
        const tabState = await getTabState(tabIdRef.current)
        setJobContext(tabState?.jobContext ?? null)
      } catch {
        // Proceed without session state — fill will still work
      }

      const profile = await fetchProfile()
      setSkillsField(findSkillsField())
      setState({ status: 'ready', profile, page })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Backlog] init error:', err)
      setState({ status: 'error', message: msg })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void init() }, [init])

  // Listen for page-update events dispatched by inject.ts (SPA navigation)
  useEffect(() => {
    const host = document.getElementById('backlog-sidebar-host')
    const shadow = host?.shadowRoot
    if (!shadow) return

    const handler = (e: Event) => {
      const newPage = (e as CustomEvent<PageInfo>).detail
      setPage(newPage)
      setSkillsField(findSkillsField())
      setState((s) => s.status === 'ready' ? { ...s, page: newPage } : s)
    }
    shadow.addEventListener('backlog:page-update', handler)
    return () => shadow.removeEventListener('backlog:page-update', handler)
  }, [])

  // Re-scan for skills field periodically on ready state
  useEffect(() => {
    if (state.status !== 'ready') return
    const t = setTimeout(() => setSkillsField(findSkillsField()), 1500)
    return () => clearTimeout(t)
  }, [state.status])

  // ── Scan — read-only preview ───────────────────────────────────────────────

  async function handleScan() {
    if (state.status !== 'ready') return
    const { profile } = state

    setState({ status: 'scanning' })
    try {
      // Small tick to let React render the scanning state before potentially
      // heavy shadow DOM traversal on Workday pages
      await new Promise<void>((r) => setTimeout(r, 50))
      const fields = computeFills(profile, page.ats)
      lastScannedRef.current = fields
      setState({ status: 'scan-preview', fields, profile, page })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      lastDebugRef.current = buildDebugExport(page, 0, lastScannedRef.current, [], [], msg)
      setState({ status: 'error', message: msg })
    }
  }

  // ── Apply scanned fields + run Tier 2/3 ───────────────────────────────────

  async function handleApplyScanned() {
    if (state.status !== 'scan-preview') return
    const { fields, profile } = state

    cancelledRef.current = false
    lastProfileRef.current = profile
    setState({ status: 'filling', stage: 'tier1' })

    let filled: FilledField[]
    try {
      filled = applyFills(fields)
      if (page.ats === 'workday') {
        const comboboxFilled = await fillWorkdayComboboxes(profile)
        filled = [...filled, ...comboboxFilled]
      }
    } catch {
      const message = 'Fill failed. Try refreshing the page.'
      lastDebugRef.current = buildDebugExport(page, 0, fields, [], [], message)
      setState({ status: 'error', message })
      return
    }

    await runTier2AndFinish(profile, filled)
  }

  // ── One-click auto-fill (scan + apply in one) ─────────────────────────────

  async function autoFill() {
    if (state.status !== 'ready') return
    const { profile } = state

    cancelledRef.current = false
    lastProfileRef.current = profile
    setState({ status: 'filling', stage: 'tier1' })

    let tier1Filled: FilledField[]
    try {
      const scanned = computeFills(profile, page.ats)
      lastScannedRef.current = scanned
      tier1Filled = applyFills(scanned)
      if (page.ats === 'workday') {
        const comboboxFilled = await fillWorkdayComboboxes(profile)
        tier1Filled = [...tier1Filled, ...comboboxFilled]
      }
    } catch {
      const message = 'Fill failed. Try refreshing the page.'
      lastDebugRef.current = buildDebugExport(page, 0, lastScannedRef.current, [], [], message)
      setState({ status: 'error', message })
      return
    }

    await runTier2AndFinish(profile, tier1Filled)
  }

  // ── Shared: Tier 2 + Tier 3 + session persist + review state ─────────────

  async function runTier2AndFinish(profile: FullProfile, initialFilled: FilledField[]) {
    let aiUnavailable = false
    const allFilled = [...initialFilled]
    const allSkipped: SkippedField[] = []

    if (cancelledRef.current) return

    // Tier 2 — Haiku analysis for unfilled fields
    const filledSelectors = new Set(initialFilled.map((f) => f.selector))
    // Import dynamically to avoid circular dependency in fill.ts
    const { getUnfilledFields } = await import('../content/fill')
    const unfilledFields = getUnfilledFields(filledSelectors)

    try {
      const fileResult = await fillFileInputs(profile, jobContext)
      allFilled.push(...fileResult.filled)
      allSkipped.push(...fileResult.skipped)
    } catch {
      allSkipped.push({ label: 'File upload', reason: 'Attach files manually — upload blocked by this site' })
    }

    if (unfilledFields.length > 0) {
      setState({ status: 'filling', stage: 'tier2' })
      try {
        const analysisResults = await Promise.race([
          analyzePage(unfilledFields),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]) as Awaited<ReturnType<typeof analyzePage>>

        const profileFills = (analysisResults as FieldAnalysisResult[]).filter(
          (r): r is Extract<FieldAnalysisResult, { type: 'value' }> => r.type === 'value'
        )
        if (profileFills.length > 0) {
          const tier2Filled = applyFieldValues(profileFills.map(r => ({ selector: r.selector, value: r.value! })))
          allFilled.push(...tier2Filled)
        }

        const openEndedFills = (analysisResults as FieldAnalysisResult[]).filter(
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
          const valid = answers
            .filter((r): r is PromiseFulfilledResult<{ selector: string; value: string }> =>
              r.status === 'fulfilled' && r.value !== null
            )
            .map(r => r.value)
          if (valid.length > 0) allFilled.push(...applyFieldValues(valid))
        }
      } catch {
        aiUnavailable = true
      }
    }

    if (cancelledRef.current) return

    // Persist to session for background auto-advance
    // chrome.storage.session is blocked on some pages (e.g. Workday) — must not throw
    const tabId = tabIdRef.current
    let debugPageIndex = 0
    if (tabId) {
      try {
        const current = await getTabState(tabId)
        const pageFill: PageFill = {
          url: page.jobTitle ? `${page.company ?? ''} — ${page.jobTitle}` : location.href,
          pageIndex: current ? current.currentPageIndex + 1 : 0,
          filled: allFilled,
        }
        debugPageIndex = pageFill.pageIndex
        await setTabState(tabId, {
          autoAdvance,
          profile,
          pages: [...(current?.pages ?? []), pageFill],
          currentPageIndex: pageFill.pageIndex,
          jobContext: current?.jobContext ?? jobContext,
          pendingSubmission: current?.pendingSubmission ?? null,
        })
      } catch { /* storage unavailable in this page context — skip persistence */ }
    }

    // Auto-advance: click Next if toggled
    if (autoAdvance) {
      const pageType = detectPageType()
      if (pageType.hasNextButton) {
        const btn = detectNextButton()
        btn?.click()
      }
    }

    setSkillsField(findSkillsField())

    // Collect skipped fields for profile gaps
    const skipped: SkippedField[] = []
    if (!profile.user.full_name) skipped.push({ label: 'Name', reason: 'Not set in profile' })
    if (!profile.user.email) skipped.push({ label: 'Email', reason: 'Not set in profile' })
    if (!profile.user.phone) skipped.push({ label: 'Phone', reason: 'Not set in profile' })
    if (!profile.user.resume_url) skipped.push({ label: 'Resume', reason: 'Upload resume in Backlog first' })
    skipped.push(...allSkipped)

    lastDebugRef.current = buildDebugExport(page, debugPageIndex, lastScannedRef.current, allFilled, skipped)

    setState({ status: 'review', filled: allFilled, skipped, page, profile, aiUnavailable })
  }

  // ── Skills improvement ─────────────────────────────────────────────────────

  async function handleImproveSkills() {
    if (state.status !== 'ready' || !skillsField) return
    setImprovingSkills(true)
    try {
      const improved = await improveSkills({
        currentSkills: skillsField.currentValue,
        profileSkills: state.profile.user.skills ?? [],
        jobDescription: page.jobDescription,
      })
      if (improved) {
        applyFieldValues([{ selector: skillsField.selector, value: improved }])
        setSkillsField({ ...skillsField, currentValue: improved })
      }
    } catch { /* silently ignore */ } finally {
      setImprovingSkills(false)
    }
  }

  // ── Add to backlog ─────────────────────────────────────────────────────────

  async function handleAddToBacklog() {
    if (state.status !== 'ready') return
    try {
      const result = await addJob({
        url: location.href,
        title: page.jobTitle ?? document.title ?? 'Unknown role',
        company: page.company ?? 'Unknown company',
        description: page.jobDescription,
      })
      setState({ status: 'added', duplicate: result.duplicate })
    } catch {
      setState({ status: 'error', message: 'Failed to save job.' })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (collapsed) {
    return (
      <button
        className="fab-appear"
        onClick={() => setCollapsed(false)}
        title="Open Backlog"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
          border: 'none',
          cursor: 'pointer',
          pointerEvents: 'auto',
          zIndex: 2147483647,
          boxShadow: '0 4px 20px rgba(79,70,229,0.45), 0 2px 6px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" fill="white" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" fill="white" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" fill="white" opacity="0.55" />
        </svg>
      </button>
    )
  }

  const isDark = theme === 'dark'

  return (
    <div
      className="panel-open"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '360px',
        maxHeight: 'calc(100vh - 40px)',
        borderRadius: '20px',
        background: isDark
          ? 'linear-gradient(180deg, #0d0d1a 0%, #09090b 40%, #09090e 100%)'
          : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(99,102,241,0.18)' : 'rgba(0,0,0,0.09)'}`,
        boxShadow: isDark
          ? '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.06)'
          : '0 8px 32px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'auto',
        zIndex: 2147483647,
      }}
    >
      {/* Ambient glow orbs */}
      <div style={{
        position: 'absolute', top: '-60px', left: '-40px',
        width: '260px', height: '260px',
        background: `radial-gradient(circle, ${isDark ? 'rgba(99,102,241,0.09)' : 'rgba(99,102,241,0.05)'} 0%, transparent 68%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'absolute', bottom: '40px', right: '-10px',
        width: '180px', height: '180px',
        background: `radial-gradient(circle, ${isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.03)'} 0%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Header ── */}
      <div style={{
        position: 'relative', zIndex: 1, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px',
        background: isDark
          ? 'linear-gradient(180deg, rgba(79,70,229,0.08) 0%, transparent 100%)'
          : 'linear-gradient(180deg, rgba(79,70,229,0.04) 0%, transparent 100%)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="#6366f1" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="#6366f1" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="#6366f1" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#6366f1" opacity="0.35" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#e4e4e7' : '#18181b', letterSpacing: '-0.01em' }}>
            Backlog
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '5px', color: isDark ? '#71717a' : '#a1a1aa',
              lineHeight: 1, borderRadius: '6px',
              display: 'flex', alignItems: 'center',
            }}
          >
            {isDark ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2.8" stroke="currentColor" strokeWidth="1.4" />
                <path d="M7 1.5v1.2M7 11.3v1.2M1.5 7h1.2M11.3 7h1.2M3.4 3.4l.85.85M9.75 9.75l.85.85M9.75 4.25l.85-.85M3.4 10.6l.85-.85" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11.5 8.5A5 5 0 0 1 5.5 2.5 5 5 0 1 0 11.5 8.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          {/* Minimize to FAB */}
          <button
            onClick={() => setCollapsed(true)}
            title="Minimize"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '5px', color: isDark ? '#71717a' : '#a1a1aa',
              lineHeight: 1, borderRadius: '6px',
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="sidebar-scroll" style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* DSA Companion mode — shown when on a NeetCode 150 LeetCode problem */}
        {page.dsaSlug && page.dsaDifficulty && (
          <DsaCompanion
            key={page.dsaSlug}
            slug={page.dsaSlug}
            difficulty={page.dsaDifficulty}
            tabId={tabId}
          />
        )}

        {/* Handshake assistant mode */}
        {!page.dsaSlug && page.ats === 'handshake' && (
          <HandshakePanel tabId={tabId} theme={theme} />
        )}

        {/* Job application mode — shown when NOT on a DSA page or Handshake */}
        {!page.dsaSlug && page.ats !== 'handshake' && (
          <>
            {jobContext && <JobContextBadge context={jobContext} />}

            {state.status === 'loading' && <LoadingState />}

            {state.status === 'no-key' && <NoKeyState onConnected={init} />}

            {state.status === 'error' && (
              <ErrorState
                message={state.message}
                debug={lastDebugRef.current}
                onRetry={() => { setState({ status: 'loading' }); void init() }}
              />
            )}

            {(state.status === 'ready' || state.status === 'filling' || state.status === 'scanning' || state.status === 'scan-preview' || state.status === 'review' || state.status === 'added') && (
              <>
                {state.status !== 'added' && (() => {
                  const profile = 'profile' in state ? state.profile : null
                  if (!profile) return null
                  return <ProfileCard profile={profile} />
                })()}

                {page.isJobPage && (
                  <JobCard page={page} />
                )}

                {!page.isJobPage && state.status === 'ready' && (
                  <p style={{ fontSize: '11px', color: '#71717a', padding: '4px 0' }}>
                    Navigate to a job application to use Auto-fill.
                  </p>
                )}
              </>
            )}

            {state.status === 'ready' && (
              <ReadyActions
                page={page}
                autoAdvance={autoAdvance}
                onAutoAdvanceChange={setAutoAdvance}
                skillsField={skillsField}
                improvingSkills={improvingSkills}
                onScan={handleScan}
                onAutoFill={autoFill}
                onImproveSkills={handleImproveSkills}
                onAddToBacklog={handleAddToBacklog}
              />
            )}

            {state.status === 'scanning' && (
              <ScanningState />
            )}

            {state.status === 'scan-preview' && (
              <ScanPreviewState
                fields={state.fields}
                page={state.page}
                onApply={handleApplyScanned}
                onCancel={() => setState({ status: 'ready', profile: state.profile, page: state.page })}
              />
            )}

            {state.status === 'filling' && (
              <FillingState
                stage={state.stage}
                onCancel={() => {
                  cancelledRef.current = true
                  const profile = lastProfileRef.current
                  if (profile) {
                    setState({ status: 'ready', profile, page })
                  } else {
                    setState({ status: 'loading' })
                    void init()
                  }
                }}
              />
            )}

            {state.status === 'review' && (
              <ReviewState
                filled={state.filled}
                skipped={state.skipped}
                aiUnavailable={state.aiUnavailable}
                debug={lastDebugRef.current}
                onDone={() => setState({ status: 'ready', profile: state.profile, page: state.page })}
              />
            )}

            {state.status === 'added' && (
              <AddedState duplicate={(state as Extract<SidebarState, { status: 'added' }>).duplicate} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function JobContextBadge({ context }: { context: JobContext }) {
  return (
    <div style={{
      margin: '0 0 2px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      borderRadius: '8px',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      background: 'rgba(59, 130, 246, 0.05)',
      padding: '8px 10px',
      flexShrink: 0,
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#60a5fa', flexShrink: 0 }}>
        <path d="M4.5 4V3.25C4.5 2.56 5.06 2 5.75 2h2.5c.69 0 1.25.56 1.25 1.25V4M2.75 4h8.5c.69 0 1.25.56 1.25 1.25v5.5c0 .69-.56 1.25-1.25 1.25h-8.5c-.69 0-1.25-.56-1.25-1.25v-5.5C1.5 4.56 2.06 4 2.75 4Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span style={{
        fontSize: '12px',
        color: '#93c5fd',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '280px',
      }}>
        Applying to: {context.jobTitle} at {context.jobCompany}
      </span>
    </div>
  )
}

function ProfileCard({ profile }: { profile: FullProfile }) {
  const name = profile.user.full_name ?? profile.user.email ?? 'Connected'
  const skills = profile.user.skills?.slice(0, 4) ?? []

  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: '8px',
      padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: skills.length ? '6px' : 0 }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 600, color: '#fff', flexShrink: 0,
        }}>
          {name[0]?.toUpperCase() ?? '?'}
        </div>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
      </div>
      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          {skills.map((s, i) => (
            <span key={i} style={{
              fontSize: '10px', padding: '2px 6px',
              background: '#27272a', color: '#a1a1aa',
              borderRadius: '99px', border: '1px solid #3f3f46',
            }}>
              {s}
            </span>
          ))}
          {(profile.user.skills?.length ?? 0) > 4 && (
            <span style={{ fontSize: '10px', color: '#52525b' }}>
              +{(profile.user.skills?.length ?? 0) - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function JobCard({ page }: { page: PageInfo }) {
  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: '8px',
      padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontSize: '11px', color: '#6ee7b7', fontWeight: 500 }}>
          {page.ats ? (ATS_LABELS[page.ats] ?? page.ats) : 'Job page'}
        </span>
      </div>
      {page.jobTitle && (
        <p style={{ fontSize: '12px', color: '#f4f4f5', fontWeight: 500, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {page.jobTitle}
        </p>
      )}
      {page.company && (
        <p style={{ fontSize: '11px', color: '#71717a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {page.company}
        </p>
      )}
    </div>
  )
}

function ReadyActions({
  page, autoAdvance, onAutoAdvanceChange, skillsField, improvingSkills,
  onScan, onAutoFill, onImproveSkills, onAddToBacklog,
}: {
  page: PageInfo
  autoAdvance: boolean
  onAutoAdvanceChange: (v: boolean) => void
  skillsField: SkillsField | null
  improvingSkills: boolean
  onScan: () => void
  onAutoFill: () => void
  onImproveSkills: () => void
  onAddToBacklog: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {page.isJobPage && (
        <>
          {/* Scan button — primary CTA for Workday/preview flow */}
          <button
            onClick={onScan}
            style={{
              width: '100%', padding: '10px',
              background: '#4f46e5', color: '#fff',
              border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 4v3l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Scan form
          </button>

          {/* Auto-fill shortcut — scan + apply in one click */}
          <button
            onClick={onAutoFill}
            style={{
              width: '100%', padding: '8px',
              background: 'transparent', color: '#a1a1aa',
              border: '1px solid #3f3f46', borderRadius: '8px',
              fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Auto-fill (skip preview)
          </button>

          {/* Skills improve button */}
          {skillsField && (
            <button
              onClick={onImproveSkills}
              disabled={improvingSkills}
              style={{
                width: '100%', padding: '9px',
                background: improvingSkills ? '#18181b' : '#052e16',
                color: improvingSkills ? '#71717a' : '#34d399',
                border: `1px solid ${improvingSkills ? '#27272a' : '#166534'}`,
                borderRadius: '8px',
                fontSize: '12px', fontWeight: 500, cursor: improvingSkills ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              {improvingSkills ? (
                <>
                  <span className="bl-spin" style={{ display: 'inline-block', width: '12px', height: '12px', border: '1.5px solid #3f3f46', borderTopColor: '#34d399', borderRadius: '50%' }} />
                  Improving skills…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 1.5L8 5H11.5L8.75 7.25L9.75 11L6.5 9L3.25 11L4.25 7.25L1.5 5H5L6.5 1.5Z" fill="currentColor" />
                  </svg>
                  Improve skills section
                </>
              )}
            </button>
          )}

          {/* Auto-advance toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', padding: '2px 0' }}>
            <div
              onClick={() => onAutoAdvanceChange(!autoAdvance)}
              style={{
                width: '28px', height: '16px', borderRadius: '99px',
                background: autoAdvance ? '#4f46e5' : '#27272a',
                border: `1px solid ${autoAdvance ? '#6366f1' : '#3f3f46'}`,
                position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: '2px',
                left: autoAdvance ? '13px' : '2px',
                width: '10px', height: '10px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ fontSize: '11px', color: '#71717a', userSelect: 'none' }}>
              Auto-advance pages
            </span>
          </label>
        </>
      )}

      {/* Add to backlog */}
      <button
        onClick={onAddToBacklog}
        disabled={!page.isJobPage}
        style={{
          width: '100%', padding: '8px',
          background: 'transparent', color: page.isJobPage ? '#a1a1aa' : '#3f3f46',
          border: `1px solid ${page.isJobPage ? '#3f3f46' : '#27272a'}`,
          borderRadius: '8px',
          fontSize: '12px', fontWeight: 500,
          cursor: page.isJobPage ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}
      >
        + Add to Backlog
      </button>
    </div>
  )
}

function ScanningState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px 0' }}>
      <span className="bl-spin" style={{
        display: 'inline-block', width: '20px', height: '20px',
        border: '2px solid #27272a', borderTopColor: '#6366f1', borderRadius: '50%',
      }} />
      <p style={{ fontSize: '12px', color: '#71717a', margin: 0, textAlign: 'center' }}>
        Scanning form fields…
      </p>
    </div>
  )
}

function AddedState({ duplicate }: { duplicate: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '24px 0', textAlign: 'center' }}>
      <span style={{ fontSize: '28px' }}>{duplicate ? '📋' : '✅'}</span>
      <p style={{ fontSize: '13px', fontWeight: 500, color: '#f4f4f5', margin: 0 }}>
        {duplicate ? 'Already in Backlog' : 'Added to Backlog!'}
      </p>
      <a
        href={BACKLOG_URL + '/feed'}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none' }}
      >
        Open Backlog →
      </a>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
      <span className="bl-spin" style={{
        display: 'inline-block', width: '16px', height: '16px',
        border: '2px solid #27272a', borderTopColor: '#6366f1', borderRadius: '50%',
      }} />
    </div>
  )
}

function NoKeyState({ onConnected }: { onConnected: () => void }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!value.startsWith('blg_')) { setErr('Keys start with blg_'); return }
    setSaving(true)
    await setApiKey(value.trim())
    setSaving(false)
    onConnected()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
      <div>
        <p style={{ fontSize: '13px', fontWeight: 500, color: '#f4f4f5', margin: '0 0 4px' }}>Connect Backlog</p>
        <p style={{ fontSize: '11px', color: '#71717a', margin: 0 }}>
          Paste your API key from{' '}
          <a href={BACKLOG_URL + '/settings'} target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>
            Settings
          </a>.
        </p>
      </div>
      <input
        type="password"
        value={value}
        onChange={(e) => { setValue(e.target.value); setErr('') }}
        onKeyDown={(e) => { if (e.key === 'Enter') void save() }}
        placeholder="blg_••••••••••••"
        autoFocus
        style={{
          width: '100%', padding: '8px 10px',
          background: '#18181b', border: '1px solid #3f3f46', borderRadius: '6px',
          fontSize: '12px', color: '#f4f4f5',
          fontFamily: 'monospace', outline: 'none',
        }}
      />
      {err && <p style={{ fontSize: '11px', color: '#f87171', margin: 0 }}>{err}</p>}
      <button
        onClick={save}
        disabled={saving || !value}
        style={{
          width: '100%', padding: '9px',
          background: saving || !value ? '#27272a' : '#f4f4f5',
          color: saving || !value ? '#52525b' : '#09090b',
          border: 'none', borderRadius: '6px',
          fontSize: '12px', fontWeight: 500, cursor: saving || !value ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Connecting…' : 'Connect'}
      </button>
    </div>
  )
}
