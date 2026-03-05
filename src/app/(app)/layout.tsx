import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { ensureDefaults } from './actions'
import { getSupabaseUserFromCookies } from '@/lib/supabase/session'

export default async function AppLayout({
  children
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const user = getSupabaseUserFromCookies(cookieStore)

  if (!user.id) {
    redirect('/login')
  }

  const defaultsPromise = ensureDefaults(user.id).catch(() => {})
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
