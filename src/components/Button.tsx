import { cn } from '@/lib/cn'
import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition focus-visible:outline-none disabled:opacity-60'
  const styles = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800',
    secondary: 'border border-brand-200 bg-transparent text-brand-700 hover:bg-brand-50/80',
    ghost: 'bg-transparent text-slate-600 hover:bg-brand-50/70 hover:text-brand-700'
  }

  return (
    <button className={cn(base, styles[variant], className)} {...props} />
  )
}
