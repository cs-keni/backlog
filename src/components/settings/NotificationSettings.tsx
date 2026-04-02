'use client'

import { useState, useEffect } from 'react'
import type { NotificationLogEntry } from '@/app/(app)/settings/page'

interface Prefs {
  notification_email: boolean
  notification_push: boolean
  notification_quiet_hours_start: string | null
  notification_quiet_hours_end: string | null
  alert_match_threshold: number
  email: string
}

interface NotificationSettingsProps {
  initialPrefs: Prefs
  recentLogs: NotificationLogEntry[]
  vapidPublicKey: string
}

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  push: 'Push',
  discord: 'Discord',
}

const CHANNEL_ICONS: Record<string, string> = {
  email: '✉️',
  push: '🔔',
  discord: '💬',
}

function formatTime(t: string | null): string {
  if (!t) return ''
  // HH:MM:SS → HH:MM
  return t.slice(0, 5)
}

function formatLogDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function NotificationSettings({ initialPrefs, recentLogs, vapidPublicKey }: NotificationSettingsProps) {
  const [prefs, setPrefs] = useState(initialPrefs)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [pushState, setPushState] = useState<'idle' | 'loading' | 'subscribed' | 'unsupported'>('idle')
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null)

  // Check current push subscription state on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported')
      return
    }
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        if (sub) {
          setPushSubscription(sub)
          setPushState('subscribed')
        }
      })
    })
  }, [])

  async function savePref(key: keyof Prefs, value: unknown) {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    setSaveState('saving')
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    } catch {
      setSaveState('idle')
    }
  }

  async function enablePush() {
    if (!vapidPublicKey) {
      alert('Push notifications are not configured yet (missing VAPID keys).')
      return
    }
    setPushState('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushState('idle')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as ArrayBuffer,
      })

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })

      setPushSubscription(sub)
      setPushState('subscribed')
      setPrefs(p => ({ ...p, notification_push: true }))
    } catch (err) {
      console.error('Push subscription failed:', err)
      setPushState('idle')
    }
  }

  async function disablePush() {
    if (!pushSubscription) return
    setPushState('loading')
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: pushSubscription.endpoint }),
      })
      await pushSubscription.unsubscribe()
      setPushSubscription(null)
      setPushState('idle')
      setPrefs(p => ({ ...p, notification_push: false }))
    } catch {
      setPushState('idle')
    }
  }

  return (
    <div className="space-y-8">
      {/* Save indicator */}
      {saveState !== 'idle' && (
        <div className={`text-xs px-3 py-1.5 rounded-md border w-fit transition-all ${
          saveState === 'saved'
            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
            : 'text-zinc-500 border-zinc-700 bg-zinc-900'
        }`}>
          {saveState === 'saving' ? 'Saving…' : 'Saved'}
        </div>
      )}

      {/* Email notifications */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Email notifications</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-sm text-zinc-200">New job alerts</p>
              <p className="text-xs text-zinc-500 mt-0.5">Receive a digest email when new jobs are found</p>
              {prefs.notification_email && prefs.email && (
                <p className="text-xs text-zinc-600 mt-0.5">Sending to: {prefs.email}</p>
              )}
            </div>
            <Toggle
              checked={prefs.notification_email}
              onChange={v => savePref('notification_email', v)}
            />
          </div>
        </div>
      </section>

      {/* Push notifications */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Browser push notifications</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-sm text-zinc-200">Push alerts</p>
              <p className="text-xs text-zinc-500 mt-0.5">Get notified in your browser when new jobs drop</p>
              {pushState === 'unsupported' && (
                <p className="text-xs text-amber-500 mt-0.5">Not supported in this browser</p>
              )}
            </div>
            {pushState === 'unsupported' ? (
              <span className="text-xs text-zinc-600">Unavailable</span>
            ) : pushState === 'subscribed' ? (
              <button
                onClick={disablePush}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
              >
                Disable
              </button>
            ) : (
              <button
                onClick={enablePush}
                disabled={pushState === 'loading' || !vapidPublicKey}
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors disabled:opacity-50"
              >
                {pushState === 'loading' ? 'Enabling…' : 'Enable'}
              </button>
            )}
          </div>
          {pushState === 'subscribed' && (
            <div className="px-4 py-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <p className="text-xs text-zinc-500">Push active on this browser</p>
            </div>
          )}
        </div>
      </section>

      {/* Match threshold */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Match threshold</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Only notify me for jobs at or above this match score</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Min score</span>
            <span className="text-sm font-semibold text-zinc-100 tabular-nums">
              {prefs.alert_match_threshold}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={prefs.alert_match_threshold}
            onChange={e => setPrefs(p => ({ ...p, alert_match_threshold: Number(e.target.value) }))}
            onMouseUp={e => savePref('alert_match_threshold', Number((e.target as HTMLInputElement).value))}
            onTouchEnd={e => savePref('alert_match_threshold', Number((e.target as HTMLInputElement).value))}
            className="w-full accent-zinc-400 h-1.5 rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>Any</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </section>

      {/* Quiet hours */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Quiet hours</h2>
          <p className="text-xs text-zinc-500 mt-0.5">No notifications will be sent during this window (UTC)</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 w-8">From</label>
              <input
                type="time"
                defaultValue={formatTime(prefs.notification_quiet_hours_start)}
                onBlur={e => savePref('notification_quiet_hours_start', e.target.value ? e.target.value + ':00' : null)}
                className="bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
            <span className="text-zinc-600 text-xs">to</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 w-4">To</label>
              <input
                type="time"
                defaultValue={formatTime(prefs.notification_quiet_hours_end)}
                onBlur={e => savePref('notification_quiet_hours_end', e.target.value ? e.target.value + ':00' : null)}
                className="bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
            {(prefs.notification_quiet_hours_start || prefs.notification_quiet_hours_end) && (
              <button
                onClick={() => {
                  savePref('notification_quiet_hours_start', null)
                  savePref('notification_quiet_hours_end', null)
                }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Notification log */}
      {recentLogs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200">Recent notifications</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800 overflow-hidden">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-base shrink-0">{CHANNEL_ICONS[log.channel] ?? '📣'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-300 truncate">
                    {log.jobs ? `${log.jobs.company} — ${log.jobs.title}` : 'Unknown job'}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    {CHANNEL_LABELS[log.channel] ?? log.channel} · {formatLogDate(log.sent_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-zinc-100' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-zinc-900 shadow-lg transition duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Utility ────────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
