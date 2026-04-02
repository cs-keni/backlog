import { useState, useEffect, useCallback } from 'react'
import { getApiKey, setApiKey, clearApiKey, fetchProfile, addJob } from '../shared/api'
import { BACKLOG_URL } from '../shared/config'
import type { FullProfile, PageInfo, FilledField, SkippedField, ExtensionMessage } from '../shared/types'

// ─── State machine ────────────────────────────────────────────────────────────

type AppState =
  | { status: 'loading' }
  | { status: 'no-key' }
  | { status: 'ready'; profile: FullProfile; page: PageInfo }
  | { status: 'filling' }
  | { status: 'review'; filled: FilledField[]; skipped: SkippedField[]; page: PageInfo; profile: FullProfile }
  | { status: 'added'; duplicate: boolean }
  | { status: 'error'; message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ATS_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  workday: 'Workday',
  generic: 'Job page',
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab ?? null
}

async function sendToContent<T>(message: ExtensionMessage): Promise<T | null> {
  try {
    const tab = await getActiveTab()
    if (!tab?.id) return null
    return await chrome.tabs.sendMessage(tab.id, message) as T
  } catch {
    return null
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const [state, setState] = useState<AppState>({ status: 'loading' })
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [saving, setSaving] = useState(false)

  const init = useCallback(async () => {
    const key = await getApiKey()
    if (!key) { setState({ status: 'no-key' }); return }

    try {
      const [profile, page] = await Promise.all([
        fetchProfile(),
        sendToContent<PageInfo>({ type: 'GET_PAGE_INFO' }),
      ])
      setState({
        status: 'ready',
        profile,
        page: page ?? { ats: null, jobTitle: null, company: null, jobDescription: null, isJobPage: false },
      })
    } catch {
      setState({ status: 'error', message: 'Could not connect to Backlog. Check your API key in Settings.' })
    }
  }, [])

  useEffect(() => { void init() }, [init])

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
    setState({ status: 'filling' })
    const result = await sendToContent<{ filled: FilledField[]; skipped: SkippedField[] }>({
      type: 'FILL_FORM',
      payload: state.profile,
    })
    if (!result) {
      setState({ status: 'error', message: 'Could not reach the page. Try refreshing.' })
      return
    }
    setState({ status: 'review', ...result, page: state.page, profile: state.profile })
  }

  async function handleAddToBacklog() {
    if (state.status !== 'ready') return
    const { page } = state
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
            onAutoFill={autoFill}
            onAddToBacklog={handleAddToBacklog}
          />
        )}

        {state.status === 'filling' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-xs text-zinc-500">Filling form…</p>
          </div>
        )}

        {state.status === 'review' && (
          <ReviewScreen
            filled={state.filled}
            skipped={state.skipped}
            onDone={() => setState({ status: 'ready', profile: state.profile, page: state.page })}
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
  profile, page, onAutoFill, onAddToBacklog,
}: {
  profile: FullProfile
  page: PageInfo
  onAutoFill: () => void
  onAddToBacklog: () => void
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
        <p className="text-xs text-zinc-500 py-2">
          Navigate to a job application page to use auto-fill.
        </p>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {page.isJobPage && (
          <button
            onClick={onAutoFill}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            Auto-fill form
          </button>
        )}
        <button
          onClick={onAddToBacklog}
          disabled={!page.isJobPage}
          className="w-full py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add to Backlog
        </button>
      </div>

      {/* Footer */}
      <p className="text-[11px] text-zinc-600 truncate">
        {userName}
      </p>
    </div>
  )
}

// ─── Review screen ────────────────────────────────────────────────────────────

function ReviewScreen({
  filled, skipped, onDone,
}: {
  filled: FilledField[]
  skipped: SkippedField[]
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
