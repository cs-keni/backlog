'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STAY_SIGNED_IN_KEY } from '@/components/auth/IdleLogout'

export function SecuritySettings() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSignOutAll = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'global' })
    localStorage.removeItem(STAY_SIGNED_IN_KEY)
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-zinc-100">Security</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Manage active sessions across all devices.
        </p>
      </div>
      <div className="rounded-lg border border-zinc-800 p-4 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-200">Sign out everywhere</p>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
            Immediately invalidates all active sessions on every device. Use this if you suspect
            your account has been compromised. You&apos;ll need to sign in again.
          </p>
        </div>
        <button
          onClick={handleSignOutAll}
          disabled={loading}
          className="shrink-0 rounded-md border border-red-800/60 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Signing out…' : 'Sign out all devices'}
        </button>
      </div>
    </div>
  )
}
