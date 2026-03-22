import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import { IdleLogout } from '@/components/auth/IdleLogout'

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
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <IdleLogout />
      <Sidebar userEmail={user.email} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
