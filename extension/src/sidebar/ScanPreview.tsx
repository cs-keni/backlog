import type { PageInfo, ScannedField } from '../shared/types'

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

export function ScanPreviewState({
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
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#52525b', padding: 0 }}>
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

          <button onClick={onApply} style={{ width: '100%', padding: '10px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s' }}>
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

