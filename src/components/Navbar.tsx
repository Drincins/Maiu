import Link from 'next/link'
import { signOut } from '@/app/(app)/actions'
import { Logo } from '@/components/Logo'

const links = [
  { href: '/dashboard', label: 'Дашборд' },
  { href: '/products', label: 'Товары' },
  { href: '/inventory', label: 'Остатки' },
  { href: '/operations', label: 'Операции' },
  { href: '/finance', label: 'Финансы' },
  { href: '/finance/settings', label: 'Справочники' }
]

type NavbarProps = {
  userEmail?: string | null
}

export default function Navbar({ userEmail }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center">
            <Logo size="sm" subtitle="Inventory" />
          </Link>
          <span className="rounded-full border border-brand-200/70 bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700">
            MVP
          </span>
        </div>
        <nav className="flex w-full flex-1 flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-600 sm:w-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 transition hover:bg-brand-50/80 hover:text-brand-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {userEmail ? (
            <span className="hidden text-xs text-slate-500 sm:inline">{userEmail}</span>
          ) : null}
          <form action={signOut}>
            <button className="rounded-full border border-brand-200/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700 transition hover:border-brand-300/70 hover:bg-brand-50/70">
              Выйти
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
