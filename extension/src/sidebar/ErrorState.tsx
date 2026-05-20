export interface DebugField {
  selector: string
  label: string
  fillResult: string
}

export interface DebugExport {
  ats: string | null
  pageIndex: number
  pageUrl: string
  fields: DebugField[]
  error?: string
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

export function DebugExportButton({ debug }: { debug: DebugExport }) {
  return (
    <button onClick={() => downloadDebugExport(debug)} style={{ width: '100%', padding: '7px 0', background: 'transparent', border: '1px solid #27272a', borderRadius: '6px', color: '#71717a', fontSize: '11px', cursor: 'pointer' }}>
      Export debug JSON
    </button>
  )
}

export function ErrorState({ message, debug, onRetry }: { message: string; debug: DebugExport | null; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
      <p style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>{message}</p>
      {debug && <DebugExportButton debug={debug} />}
      <button onClick={onRetry} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#71717a', padding: 0, textDecoration: 'underline', textAlign: 'left' }}>
        Try again
      </button>
    </div>
  )
}

