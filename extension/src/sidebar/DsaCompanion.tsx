import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchDsaHints, postDsaAttempt } from '../shared/api'
import {
  PHASE_DURATIONS, INACTIVITY_THRESHOLD_PERCENT, DSA_PHASES, PHASE_LABELS,
  saveDsaAttempt, clearDsaAttempt, buildAttempt,
} from '../content/dsa-coach'
import type { ProblemHints, DsaPhase, DsaLanguage } from '../shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function phaseProgress(elapsed: number, phaseLimit: number): number {
  return Math.min(elapsed / (phaseLimit * 60), 1)
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DsaCompanionProps {
  slug: string
  difficulty: 'easy' | 'medium' | 'hard'
  tabId: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DsaCompanion({ slug, difficulty, tabId }: DsaCompanionProps) {
  const [hints, setHints] = useState<ProblemHints | null | 'unavailable'>(null)
  const [phase, setPhase] = useState<DsaPhase>('read')
  const [elapsed, setElapsed] = useState(0)     // seconds in current phase
  const [revealedLayers, setRevealedLayers] = useState<number[]>([])
  const [language, setLanguage] = useState<DsaLanguage>('python')
  const [showNudge, setShowNudge] = useState(false)
  const [done, setDone] = useState(false)

  const attemptIdRef = useRef(crypto.randomUUID())
  const lastKeystrokeRef = useRef(Date.now())
  const phaseStartRef = useRef(Date.now())
  const hintCountRef = useRef(0)
  const phaseRef = useRef<DsaPhase>('read')
  const totalTimeRef = useRef(0)
  const phaseTimingsRef = useRef<Partial<Record<DsaPhase, number>>>({})
  const nudgeCountRef = useRef(0)
  const nudgeActiveRef = useRef(false)
  const pausedSinceRef = useRef<number | null>(null)

  const phaseLimit = PHASE_DURATIONS[phase][difficulty] // minutes
  const progress = phaseProgress(elapsed, phaseLimit)
  const isOverLimit = progress >= 1
  const isNearLimit = progress >= 0.8

  // ── Fetch hints on mount ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetchDsaHints(slug).then((h) => {
      if (cancelled) return
      setHints(h ?? 'unavailable')
    })
    return () => { cancelled = true }
  }, [slug])

  // ── Timer tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (done) return
    const id = setInterval(() => {
      if (pausedSinceRef.current !== null) return
      const now = Date.now()
      const phaseElapsed = Math.floor((now - phaseStartRef.current) / 1000)
      setElapsed(phaseElapsed)
      totalTimeRef.current += 1

      // Inactivity nudge: elapsed > INACTIVITY_THRESHOLD_PERCENT% of phase limit
      // AND no keystroke in that same window
      const thresholdSec = (phaseLimit * 60 * INACTIVITY_THRESHOLD_PERCENT) / 100
      const keystrokeAge = (now - lastKeystrokeRef.current) / 1000
      if (phaseElapsed >= thresholdSec && keystrokeAge >= thresholdSec) {
        if (!nudgeActiveRef.current) {
          nudgeCountRef.current += 1
          nudgeActiveRef.current = true
        }
        setShowNudge(true)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [done, phase, phaseLimit])

  // ── Keystroke inactivity detector ─────────────────────────────────────────
  useEffect(() => {
    const onKey = () => {
      lastKeystrokeRef.current = Date.now()
      nudgeActiveRef.current = false
      setShowNudge(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── Auto-save to chrome.storage.local every 30s ───────────────────────────
  const buildCurrentAttempt = useCallback(() => buildAttempt(
    attemptIdRef.current, slug, phaseRef.current, totalTimeRef.current,
    hintCountRef.current, revealedLayers, language,
    { ...phaseTimingsRef.current }, nudgeCountRef.current
  ), [slug, revealedLayers, language])

  useEffect(() => {
    if (done) return
    const id = setInterval(() => {
      void saveDsaAttempt(tabId, buildCurrentAttempt())
    }, 30_000)
    return () => clearInterval(id)
  }, [done, tabId, buildCurrentAttempt])

  // ── visibilitychange → pause timer + save to storage ─────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        pausedSinceRef.current = Date.now()
        void saveDsaAttempt(tabId, buildCurrentAttempt())
      } else if (document.visibilityState === 'visible' && pausedSinceRef.current !== null) {
        // Shift phaseStart forward by the pause duration so elapsed doesn't count dead time
        const pausedMs = Date.now() - pausedSinceRef.current
        phaseStartRef.current += pausedMs
        pausedSinceRef.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [tabId, buildCurrentAttempt])

  // ── SPA navigation to new problem → post + unmount via key prop ───────────
  // DsaCompanion is rendered with key={slug} so navigating to a new problem
  // causes React to unmount this instance (triggering cleanup) and mount a new one.
  useEffect(() => {
    return () => {
      // Capture final phase timing before posting
      const finalPhaseElapsed = Math.floor((Date.now() - phaseStartRef.current) / 1000)
      const timings = { ...phaseTimingsRef.current, [phaseRef.current]: finalPhaseElapsed }
      const attempt = buildAttempt(
        attemptIdRef.current, slug, phaseRef.current, totalTimeRef.current,
        hintCountRef.current, revealedLayers, language,
        timings, nudgeCountRef.current
      )
      void postDsaAttempt(attempt)
      void clearDsaAttempt(tabId)
    }
    // Intentionally only run cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function advancePhase() {
    const idx = DSA_PHASES.indexOf(phase)
    if (idx >= DSA_PHASES.length - 1) return
    // Record time spent in the phase we're leaving
    phaseTimingsRef.current[phase] = elapsed
    const nextPhase = DSA_PHASES[idx + 1]
    phaseRef.current = nextPhase
    phaseStartRef.current = Date.now()
    setPhase(nextPhase)
    setElapsed(0)
    setShowNudge(false)
    nudgeActiveRef.current = false
    lastKeystrokeRef.current = Date.now()
  }

  function revealNextLayer() {
    const nextLayer = revealedLayers.length + 1
    if (nextLayer > 4) return
    hintCountRef.current += 1
    setRevealedLayers([...revealedLayers, nextLayer])
  }

  async function handleDone() {
    setDone(true)
    // Capture final phase timing before building the attempt
    const finalPhaseElapsed = Math.floor((Date.now() - phaseStartRef.current) / 1000)
    phaseTimingsRef.current[phaseRef.current] = finalPhaseElapsed
    const attempt = buildCurrentAttempt()
    await postDsaAttempt(attempt)
    await clearDsaAttempt(tabId)
  }

  function handleReset() {
    attemptIdRef.current = crypto.randomUUID()
    phaseRef.current = 'read'
    phaseTimingsRef.current = {}
    nudgeCountRef.current = 0
    nudgeActiveRef.current = false
    pausedSinceRef.current = null
    totalTimeRef.current = 0
    hintCountRef.current = 0
    phaseStartRef.current = Date.now()
    lastKeystrokeRef.current = Date.now()
    setPhase('read')
    setElapsed(0)
    setRevealedLayers([])
    setShowNudge(false)
    setDone(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const barColor = isOverLimit ? '#ef4444' : isNearLimit ? '#f97316' : '#6366f1'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Problem badge ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 10px',
        background: '#18181b', border: '1px solid #27272a', borderRadius: '8px',
      }}>
        <span style={{
          fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '99px',
          background: difficulty === 'easy' ? '#052e16' : difficulty === 'medium' ? '#431407' : '#3b0764',
          color: difficulty === 'easy' ? '#34d399' : difficulty === 'medium' ? '#fb923c' : '#c084fc',
          border: `1px solid ${difficulty === 'easy' ? '#166534' : difficulty === 'medium' ? '#9a3412' : '#7e22ce'}`,
          flexShrink: 0, textTransform: 'capitalize',
        }}>
          {difficulty}
        </span>
        <span style={{ fontSize: '12px', color: '#e4e4e7', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      </div>

      {/* ── Phase timer ── */}
      <div style={{
        background: '#18181b', border: `1px solid ${isOverLimit ? '#7f1d1d' : '#27272a'}`,
        borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px',
        transition: 'border-color 0.3s',
      }}>
        {/* Phase tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {DSA_PHASES.map((p) => (
            <span key={p} style={{
              flex: 1, textAlign: 'center', fontSize: '10px', padding: '3px 0',
              borderRadius: '4px', fontWeight: p === phase ? 600 : 400,
              background: p === phase ? '#27272a' : 'transparent',
              color: p === phase ? '#e4e4e7' : '#52525b',
              transition: 'all 0.15s',
            }}>
              {PHASE_LABELS[p]}
            </span>
          ))}
        </div>

        {/* Timer display */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '22px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: barColor, transition: 'color 0.3s' }}>
            {formatTime(elapsed)}
          </span>
          <span style={{ fontSize: '11px', color: '#52525b' }}>
            / {phaseLimit}m limit
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: '4px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '99px',
            width: `${Math.min(progress * 100, 100)}%`,
            background: barColor,
            transition: 'width 1s linear, background 0.3s',
          }} />
        </div>

        {/* Next phase button */}
        {DSA_PHASES.indexOf(phase) < DSA_PHASES.length - 1 && (
          <button
            onClick={advancePhase}
            style={{
              padding: '6px', background: 'transparent',
              border: '1px solid #3f3f46', borderRadius: '6px',
              fontSize: '11px', color: '#a1a1aa', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Next Phase: {PHASE_LABELS[DSA_PHASES[DSA_PHASES.indexOf(phase) + 1]]} →
          </button>
        )}
      </div>

      {/* ── Nudge banner ── */}
      {showNudge && (
        <div style={{
          padding: '8px 10px',
          background: 'rgba(249, 115, 22, 0.1)',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          borderRadius: '8px',
          fontSize: '12px', color: '#fed7aa',
          animation: 'bl-fade-in 0.3s ease',
        }}>
          Still thinking? Want a pointer? ↓
        </div>
      )}

      {/* ── Language toggle ── */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {(['python', 'java', 'js'] as DsaLanguage[]).map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            style={{
              flex: 1, padding: '5px',
              background: language === lang ? '#27272a' : 'transparent',
              border: `1px solid ${language === lang ? '#3f3f46' : '#27272a'}`,
              borderRadius: '6px',
              fontSize: '11px', fontWeight: 500,
              color: language === lang ? '#e4e4e7' : '#52525b',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {lang === 'js' ? 'JS' : lang.charAt(0).toUpperCase() + lang.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Hint layers ── */}
      <HintPanel
        hints={hints}
        language={language}
        revealedLayers={revealedLayers}
        onReveal={revealNextLayer}
      />

      {/* ── Done button ── */}
      {!done ? (
        <button
          onClick={() => { void handleDone() }}
          style={{
            width: '100%', padding: '9px',
            background: '#052e16', color: '#34d399',
            border: '1px solid #166534', borderRadius: '8px',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Done — log attempt
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#34d399' }}>Attempt logged!</span>
          <button
            onClick={handleReset}
            style={{
              padding: '6px 14px',
              background: 'transparent', color: '#71717a',
              border: '1px solid #3f3f46', borderRadius: '6px',
              fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            Practice again
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Hint panel ───────────────────────────────────────────────────────────────

function HintPanel({
  hints,
  language,
  revealedLayers,
  onReveal,
}: {
  hints: ProblemHints | null | 'unavailable'
  language: DsaLanguage
  revealedLayers: number[]
  onReveal: () => void
}) {
  if (hints === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
        <span className="bl-spin" style={{
          display: 'inline-block', width: '14px', height: '14px',
          border: '2px solid #27272a', borderTopColor: '#6366f1', borderRadius: '50%',
        }} />
      </div>
    )
  }

  if (hints === 'unavailable') {
    return (
      <div style={{
        padding: '10px 12px',
        background: '#18181b', border: '1px solid #27272a', borderRadius: '8px',
        fontSize: '11px', color: '#71717a', textAlign: 'center',
      }}>
        Hints unavailable
      </div>
    )
  }

  const allRevealed = revealedLayers.length >= 4
  const nextLayerNum = revealedLayers.length + 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Layer 1 — Pattern name */}
      {revealedLayers.includes(1) && (
        <HintCard label="Pattern">
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#a5b4fc' }}>{hints.layer1}</span>
        </HintCard>
      )}

      {/* Layer 2 — Language-aware data structure */}
      {revealedLayers.includes(2) && (
        <HintCard label="Data structure">
          <code style={{ fontSize: '12px', color: '#86efac', display: 'block', marginBottom: '4px' }}>
            {hints.layer2[language]}
          </code>
          <span style={{ fontSize: '11px', color: '#a1a1aa' }}>{hints.layer2.description}</span>
        </HintCard>
      )}

      {/* Layer 3 — Algorithm + complexity */}
      {revealedLayers.includes(3) && (
        <HintCard label="Algorithm">
          <span style={{ fontSize: '12px', color: '#e4e4e7', display: 'block', marginBottom: '4px' }}>
            {hints.layer3.algorithm}
          </span>
          <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: '#71717a' }}>
            <span>Time: <span style={{ color: '#fbbf24' }}>{hints.layer3.timeComplexity}</span></span>
            <span>Space: <span style={{ color: '#fbbf24' }}>{hints.layer3.spaceComplexity}</span></span>
          </div>
        </HintCard>
      )}

      {/* Layer 4 — Brute force pseudocode */}
      {revealedLayers.includes(4) && (
        <HintCard label="Brute force sketch">
          <pre style={{
            fontSize: '10px', color: '#d1d5db', margin: 0,
            fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5,
          }}>
            {hints.layer4}
          </pre>
        </HintCard>
      )}

      {/* Reveal button */}
      {!allRevealed && (
        <button
          onClick={onReveal}
          style={{
            width: '100%', padding: '8px',
            background: 'transparent', color: '#71717a',
            border: '1px dashed #3f3f46', borderRadius: '8px',
            fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          Reveal hint {nextLayerNum} / 4
        </button>
      )}
    </div>
  )
}

function HintCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: '#18181b', border: '1px solid #27272a', borderRadius: '8px',
      animation: 'bl-fade-in 0.25s ease',
    }}>
      <p style={{ fontSize: '10px', color: '#52525b', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </p>
      {children}
    </div>
  )
}
