import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IdleLogout } from '@/components/auth/IdleLogout'
import { ServiceWorkerRegistration } from '@/components/auth/ServiceWorkerRegistration'
import { ToastProvider } from '@/components/ui/Toaster'
import { AppShell } from '@/components/layout/AppShell'
import { cookies } from 'next/headers'
import { E2E_AUTH_COOKIE, isE2ETestMode } from '@/lib/e2e/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  if (isE2ETestMode() && cookieStore.get(E2E_AUTH_COOKIE)?.value === '1') {
    return (
      <ToastProvider>
        <AppShell userEmail="e2e@example.com">{children}</AppShell>
      </ToastProvider>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <ToastProvider>
      <IdleLogout />
      <ServiceWorkerRegistration />
      <AppShell userEmail={user.email}>{children}</AppShell>
    </ToastProvider>
  )
}
