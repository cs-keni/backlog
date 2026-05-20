import { useState } from 'react'
import { detectNextButton, detectPageType } from '../content/detect'
import type { FilledField, SkippedField } from '../shared/types'
import { DebugExportButton, type DebugExport } from './ErrorState'

export function ReviewState({
  filled, skipped, aiUnavailable, debug, onDone,
}: {
  filled: FilledField[]
  skipped: SkippedField[]
  aiUnavailable: boolean
  debug: DebugExport | null
  onDone: () => void
}) {
  const [pageType] = useState(() => detectPageType())

  const handleContinue = () => {
    if (pageType.hasNextButton) detectNextButton()?.click()
    onDone()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#f4f4f5' }}>
          {filled.length} field{filled.length !== 1 ? 's' : ''} filled
        </span>
        <button onClick={onDone} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#52525b', padding: 0 }}>
          ← Back
        </button>
      </div>

      {aiUnavailable && (
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 10px' }}>
          <p style={{ fontSize: '11px', color: '#71717a', margin: 0 }}>AI analysis unavailable — filled with profile data only.</p>
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
        <button onClick={handleContinue} style={{ width: '100%', padding: '8px 0', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.01em' }}>
          {pageType.nextButtonText ?? 'Continue'} →
        </button>
      ) : (
        <p style={{ fontSize: '11px', color: '#52525b', margin: 0 }}>Review the form, then submit when ready.</p>
      )}

      {debug && <DebugExportButton debug={debug} />}
    </div>
  )
}

