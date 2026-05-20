export type FillStage = 'tier1' | 'tier2' | 'answering'

const STAGE_LABELS: Record<FillStage, string> = {
  tier1: 'Filling standard fields…',
  tier2: 'Enhancing with AI…',
  answering: 'Drafting answers…',
}

export function FillingState({ stage, onCancel }: { stage: FillStage; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px 0' }}>
      <span className="bl-spin" style={{ display: 'inline-block', width: '20px', height: '20px', border: '2px solid #27272a', borderTopColor: '#6366f1', borderRadius: '50%' }} />
      <p style={{ fontSize: '12px', color: '#71717a', margin: 0, textAlign: 'center' }}>{STAGE_LABELS[stage]}</p>
      {stage === 'tier2' && (
        <p style={{ fontSize: '11px', color: '#52525b', margin: 0, textAlign: 'center', maxWidth: '220px' }}>
          Analyzing fields that couldn't be matched automatically…
        </p>
      )}
      <button onClick={onCancel} style={{ marginTop: '4px', background: 'none', border: '1px solid #3f3f46', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', color: '#71717a', cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  )
}

