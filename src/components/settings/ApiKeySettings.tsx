'use client'

import { useState, useEffect } from 'react'

interface ApiKey {
  id: string
  label: string
  last_used_at: string | null
  created_at: string
}

export function ApiKeySettings() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/keys')
      .then((r) => r.json())
      .then((d) => setKeys((d as { keys: ApiKey[] }).keys ?? []))
  }, [])

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/keys', { method: 'POST' })
      const data = await res.json() as { key: string; id: string; label: string }
      setNewKey(data.key)
      setKeys((prev) => [{ id: data.id, label: data.label, last_used_at: null, created_at: new Date().toISOString() }, ...prev])
    } finally {
      setGenerating(false)
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    setKeys((prev) => prev.filter((k) => k.id !== id))
    if (newKey) setNewKey(null)
  }

  async function copyKey() {
    if (!newKey) return
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-200">Extension API key</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Paste this key into the Backlog browser extension to link your account.
        </p>
      </div>

      {/* One-time key display */}
      {newKey && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <p className="text-xs text-amber-400 font-medium">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-zinc-200 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 truncate">
              {newKey}
            </code>
            <button
              onClick={copyKey}
              className={`shrink-0 text-xs px-3 py-2 rounded-lg border transition-colors ${
                copied
                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                  : 'border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500'
              }`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            I&apos;ve saved it — dismiss
          </button>
        </div>
      )}

      {/* Key list */}
      {keys.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800 overflow-hidden">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200 font-medium">{key.label}</p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Created {formatDate(key.created_at)}
                  {key.last_used_at && ` · Last used ${formatDate(key.last_used_at)}`}
                </p>
              </div>
              <button
                onClick={() => revoke(key.id)}
                className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/40 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {keys.length === 0 && !newKey && (
        <p className="text-xs text-zinc-600">No active keys. Generate one to connect the extension.</p>
      )}

      {/* Generate button — only show if no active keys (one key per user is enough) */}
      {keys.length === 0 && (
        <button
          onClick={generate}
          disabled={generating}
          className="text-xs px-3 py-2 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate API key'}
        </button>
      )}
    </section>
  )
}
