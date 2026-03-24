'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Sign out after 10 minutes of inactivity
const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const LAST_SEEN_KEY = 'backlog_last_seen'

export function IdleLogout() {
  const router = useRouter()

  useEffect(() => {
    function updateLastSeen() {
      localStorage.setItem(LAST_SEEN_KEY, Date.now().toString())
    }

    async function checkIdle() {
      const raw = localStorage.getItem(LAST_SEEN_KEY)
      if (raw && Date.now() - parseInt(raw, 10) > IDLE_TIMEOUT_MS) {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
      } else {
        updateLastSeen()
      }
    }

    // Check on mount and whenever the window regains focus
    void checkIdle()
    window.addEventListener('focus', () => void checkIdle())

    // Keep the timestamp fresh on any user activity
    const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, updateLastSeen, { passive: true }))

    return () => {
      window.removeEventListener('focus', () => void checkIdle())
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, updateLastSeen))
    }
  }, [router])

  return null
}
