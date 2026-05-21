'use client'

import { useEffect, useState } from 'react'

interface InterviewKitProps {
  applicationId: string
}

interface CachedKit {
  id: string
  application_id: string
  generated_at: string
  content: string
}

function generatedLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Generated today'
  if (days === 1) return 'Generated 1 day ago'
  return `Generated ${days} days ago`
}

function MarkdownLite({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-zinc-400">
      {content.split('\n').filter(Boolean).map((line, index) => {
        if (/^\d+\.\s+\*\*/.test(line)) {
          return <h4 key={index} className="pt-2 text-xs font-semibold text-zinc-200">{line.replace(/\*\*/g, '')}</h4>
        }
        if (/^- /.test(line)) {
          return <p key={index} className="pl-3 text-zinc-400">{line}</p>
        }
        return <p key={index}>{line.replace(/\*\*/g, '')}</p>
      })}
    </div>
  )
}

export function InterviewKit({ applicationId }: InterviewKitProps) {
  const [kit, setKit] = useState<CachedKit | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/prep/interview-kit?application_id=${applicationId}`)
      .then(res => res.ok ? res.json() : null)
      .then((data: CachedKit | null) => {
        setKit(data)
        setContent(data?.content ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [applicationId])

  async function generate() {
    setGenerating(true)
    setError(null)
    setContent('')

    try {
      const res = await fetch('/api/prep/interview-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      })
      if (!res.ok || !res.body) throw new Error('Failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullContent += chunk
        setContent(fullContent)
      }

      const saveRes = await fetch('/api/prep/interview-kit/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId, content: fullContent }),
      })
      if (saveRes.ok) {
        const saved = await saveRes.json() as CachedKit
        setKit(saved)
      }
    } catch {
      setError('Could not generate interview kit')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Interview Kit</h3>
          {kit && <p className="mt-0.5 text-[11px] text-zinc-600">{generatedLabel(kit.generated_at)}</p>}
        </div>
        <button
          onClick={generate}
          disabled={loading || generating}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
        >
          {generating ? 'Generating…' : content ? 'Regenerate' : 'Generate Kit'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {loading ? (
        <div className="h-20 animate-pulse rounded-lg bg-zinc-900" />
      ) : content ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <MarkdownLite content={content} />
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-4 text-xs text-zinc-500">
          Generate a concise brief for this interview loop.
        </div>
      )}
    </div>
  )
}
