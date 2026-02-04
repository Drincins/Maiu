import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import { ensureDefaults } from './actions'

export default async function AppLayout({
  children
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const defaultsPromise = ensureDefaults().catch(() => {})
  await Promise.race([
    defaultsPromise,
    new Promise<void>((resolve) => setTimeout(resolve, 1500))
  ])

  return (
    <div className="min-h-screen">
      <Navbar userEmail={user.email} />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </div>
  )
}
