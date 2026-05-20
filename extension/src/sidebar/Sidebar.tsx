import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getApiKey, setApiKey, fetchProfile, analyzePage, answerQuestion, improveSkills, addJob,
} from '../shared/api'
import { computeFills, applyFills, applyFieldValues, getLabelForInput, fillWorkdayComboboxes, fillFileInputs } from '../content/fill'
import { detectNextButton, detectPageType } from '../content/detect'
import type {
  FullProfile, PageInfo, FilledField, SkippedField,
  FieldAnalysisResult, PageFill, TabSessionState, ScannedField, JobContext,
} from '../shared/types'
import { BACKLOG_URL } from '../shared/config'

// ─── Types ────────────────────────────────────────────────────────────────────

type FillStage = 'tier1' | 'tier2' | 'answering'

interface DebugField {
  selector: string
  label: string
  fillResult: string
}

interface DebugExport {
  ats: string | null
  pageIndex: number
  pageUrl: string
  fields: DebugField[]
  error?: string
}

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
  generic: 'Job page',
}

const STAGE_LABELS: Record<FillStage, string> = {
  tier1: 'Filling standard fields…',
  tier2: 'Enhancing with AI…',
  answering: 'Drafting answers…',
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

function downloadDebugExport(debug: DebugExport) {
  const blob = new Blob([JSON.stringify(debug, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `backlog-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar({ initialPage }: { initialPage: PageInfo }) {
  const [state, setState] = useState<SidebarState>({ status: 'loading' })
  const [collapsed, setCollapsed] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [skillsField, setSkillsField] = useState<SkillsField | null>(null)
  const [improvingSkills, setImprovingSkills] = useState(false)
  const [page, setPage] = useState<PageInfo>(initialPage)
  const [jobContext, setJobContext] = useState<JobContext | null>(null)
  const tabIdRef = useRef<number>(0)
  const cancelledRef = useRef(false)
  const lastProfileRef = useRef<FullProfile | null>(null)
  const lastScannedRef = useRef<ScannedField[]>([])
  const lastDebugRef = useRef<DebugExport | null>(null)

  // When collapsed, the mount div (360×100vh, pointer-events:auto) would still eat
  // clicks on the underlying page even though visually only the 28px tab is visible.
  // Set it to pointer-events:none when collapsed; the tab div overrides with its own auto.
  useEffect(() => {
    const host = document.getElementById('backlog-sidebar-host')
    const inner = host?.shadowRoot?.getElementById('backlog-sidebar-inner')
    if (inner) inner.style.pointerEvents = collapsed ? 'none' : 'auto'
  }, [collapsed])

  const init = useCallback(async () => {
    try {
      const key = await getApiKey()
      if (!key) { setState({ status: 'no-key' }); return }

      tabIdRef.current = await getTabId()
      const tabState = await getTabState(tabIdRef.current)
      setJobContext(tabState?.jobContext ?? null)
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
      <div
        onClick={() => setCollapsed(false)}
        style={{
          position: 'fixed',
          top: '50%',
          right: 0,
          transform: 'translateY(-50%)',
          width: '28px',
          height: '72px',
          background: '#18181b',
          border: '1px solid #3f3f46',
          borderRight: 'none',
          borderRadius: '6px 0 0 6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2147483647,
          boxShadow: '-2px 0 12px rgba(0,0,0,0.4)',
          transition: 'background 0.15s',
          pointerEvents: 'auto', // parent mount div is pointer-events:none when collapsed
        }}
        title="Open Backlog"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="5" height="5" rx="1" fill="#6366f1" />
          <rect x="9" y="2" width="5" height="5" rx="1" fill="#6366f1" />
          <rect x="2" y="9" width="5" height="5" rx="1" fill="#6366f1" />
          <rect x="9" y="9" width="5" height="5" rx="1" fill="#6366f1" opacity="0.4" />
        </svg>
      </div>
    )
  }

  return (
    <div
      className="sidebar-enter"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '360px',
        height: '100vh',
        background: '#09090b',
        borderLeft: '1px solid #27272a',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
        zIndex: 2147483647,
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #27272a',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="#6366f1" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="#6366f1" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="#6366f1" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#6366f1" opacity="0.35" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>Backlog</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            color: '#71717a', lineHeight: 1, borderRadius: '4px',
            transition: 'color 0.15s',
          }}
          title="Collapse"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10 4L7 7L10 10M7 4L4 7L7 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

const SOURCE_LABEL: Record<ScannedField['source'], string> = {
  'automation-id': 'WD',
  'label': 'label',
  'aria': 'aria',
}

const SOURCE_COLOR: Record<ScannedField['source'], string> = {
  'automation-id': '#6366f1',
  'label': '#52525b',
  'aria': '#52525b',
}

function ScanPreviewState({
  fields, page, onApply, onCancel,
}: {
  fields: ScannedField[]
  page: PageInfo
  onApply: () => void
  onCancel: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#f4f4f5' }}>
          {fields.length} field{fields.length !== 1 ? 's' : ''} detected
          {page.ats === 'workday' && (
            <span style={{ marginLeft: '6px', fontSize: '10px', color: '#6366f1', fontWeight: 400 }}>· Workday</span>
          )}
        </span>
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#52525b', padding: 0 }}
        >
          ← Back
        </button>
      </div>

      {fields.length === 0 ? (
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px' }}>
          <p style={{ fontSize: '11px', color: '#71717a', margin: 0 }}>
            No fillable fields detected. The form may still be loading, or this page uses a format we don't recognize yet.
          </p>
        </div>
      ) : (
        <>
          <div className="sidebar-scroll" style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {fields.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', padding: '4px 0', alignItems: 'flex-start', borderBottom: '1px solid #18181b' }}>
                <span style={{
                  fontSize: '9px', fontWeight: 600, padding: '1px 4px', borderRadius: '3px',
                  background: SOURCE_COLOR[f.source] + '22',
                  color: SOURCE_COLOR[f.source],
                  flexShrink: 0, marginTop: '1px', letterSpacing: '0.03em',
                }}>
                  {SOURCE_LABEL[f.source]}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '11px', color: '#71717a', textTransform: 'capitalize' }}>{f.label}</span>
                  <span style={{ fontSize: '11px', color: '#71717a' }}> → </span>
                  <span style={{ fontSize: '11px', color: '#e4e4e7', wordBreak: 'break-all' }}>{f.value}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onApply}
            style={{
              width: '100%', padding: '10px',
              background: '#4f46e5', color: '#fff',
              border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            Apply {fields.length} field{fields.length !== 1 ? 's' : ''}
          </button>
        </>
      )}

      <p style={{ fontSize: '10px', color: '#3f3f46', margin: 0 }}>
        Review values above — click Apply to write to the form.
        {page.ats === 'workday' && ' Workday dropdown fields are filled after text fields.'}
      </p>
    </div>
  )
}

function FillingState({ stage, onCancel }: { stage: FillStage; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px 0' }}>
      <span className="bl-spin" style={{
        display: 'inline-block', width: '20px', height: '20px',
        border: '2px solid #27272a', borderTopColor: '#6366f1', borderRadius: '50%',
      }} />
      <p style={{ fontSize: '12px', color: '#71717a', margin: 0, textAlign: 'center' }}>
        {STAGE_LABELS[stage]}
      </p>
      {stage === 'tier2' && (
        <p style={{ fontSize: '11px', color: '#52525b', margin: 0, textAlign: 'center', maxWidth: '220px' }}>
          Analyzing fields that couldn't be matched automatically…
        </p>
      )}
      <button
        onClick={onCancel}
        style={{
          marginTop: '4px',
          background: 'none', border: '1px solid #3f3f46',
          borderRadius: '6px', padding: '4px 12px',
          fontSize: '11px', color: '#71717a', cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  )
}

function ReviewState({
  filled, skipped, aiUnavailable, debug, onDone,
}: {
  filled: FilledField[]
  skipped: SkippedField[]
  aiUnavailable: boolean
  debug: DebugExport | null
  onDone: () => void
}) {
  // Detect the next/continue button once when the review panel mounts.
  // useState initializer runs once — safe to call DOM APIs here.
  const [pageType] = useState(() => detectPageType())

  const handleContinue = () => {
    if (pageType.hasNextButton) {
      detectNextButton()?.click()
    }
    onDone()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#f4f4f5' }}>
          {filled.length} field{filled.length !== 1 ? 's' : ''} filled
        </span>
        <button
          onClick={onDone}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#52525b', padding: 0 }}
        >
          ← Back
        </button>
      </div>

      {aiUnavailable && (
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 10px' }}>
          <p style={{ fontSize: '11px', color: '#71717a', margin: 0 }}>
            AI analysis unavailable — filled with profile data only.
          </p>
        </div>
      )}

      {filled.length > 0 && (
        <div className="sidebar-scroll" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filled.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', padding: '3px 0', alignItems: 'flex-start' }}>
              <span style={{ color: '#34d399', fontSize: '11px', flexShrink: 0, marginTop: '1px' }}>✓</span>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '11px', color: '#71717a' }}>{f.label}: </span>
                <span style={{ fontSize: '11px', color: '#e4e4e7', wordBreak: 'break-all' }}>{f.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {skipped.length > 0 && (
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 10px' }}>
          <p style={{ fontSize: '10px', fontWeight: 600, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
            Needs manual input
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {skipped.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ color: '#52525b', fontSize: '11px', flexShrink: 0 }}>○</span>
                <div>
                  <span style={{ fontSize: '11px', color: '#71717a' }}>{f.label}: </span>
                  <span style={{ fontSize: '11px', color: '#52525b' }}>{f.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pageType.hasNextButton ? (
        <button
          onClick={handleContinue}
          style={{
            width: '100%',
            padding: '8px 0',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.01em',
          }}
        >
          {pageType.nextButtonText ?? 'Continue'} →
        </button>
      ) : (
        <p style={{ fontSize: '11px', color: '#52525b', margin: 0 }}>
          Review the form, then submit when ready.
        </p>
      )}

      {debug && <DebugExportButton debug={debug} />}
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

function DebugExportButton({ debug }: { debug: DebugExport }) {
  return (
    <button
      onClick={() => downloadDebugExport(debug)}
      style={{
        width: '100%',
        padding: '7px 0',
        background: 'transparent',
        border: '1px solid #27272a',
        borderRadius: '6px',
        color: '#71717a',
        fontSize: '11px',
        cursor: 'pointer',
      }}
    >
      Export debug JSON
    </button>
  )
}

function ErrorState({ message, debug, onRetry }: { message: string; debug: DebugExport | null; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
      <p style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>{message}</p>
      {debug && <DebugExportButton debug={debug} />}
      <button
        onClick={onRetry}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#71717a', padding: 0, textDecoration: 'underline', textAlign: 'left' }}
      >
        Try again
      </button>
    </div>
  )
}
