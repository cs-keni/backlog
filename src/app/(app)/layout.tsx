import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IdleLogout } from '@/components/auth/IdleLogout'
import { ServiceWorkerRegistration } from '@/components/auth/ServiceWorkerRegistration'
import { ToastProvider } from '@/components/ui/Toaster'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
