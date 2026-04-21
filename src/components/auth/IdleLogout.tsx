'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const LAST_SEEN_KEY = 'backlog_last_seen'

export function IdleLogout() {
  const router = useRouter()

  const updateLastSeen = useCallback(() => {
    localStorage.setItem(LAST_SEEN_KEY, Date.now().toString())
  }, [])

  const checkIdle = useCallback(async () => {
    const raw = localStorage.getItem(LAST_SEEN_KEY)
    if (raw && Date.now() - parseInt(raw, 10) > IDLE_TIMEOUT_MS) {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } else {
      updateLastSeen()
    }
  }, [router, updateLastSeen])

  useEffect(() => {
    const handleFocus = () => void checkIdle()

    void checkIdle()
    window.addEventListener('focus', handleFocus)

    const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, updateLastSeen, { passive: true }))

    return () => {
      window.removeEventListener('focus', handleFocus)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, updateLastSeen))
    }
  }, [checkIdle, updateLastSeen])

  return null
}
