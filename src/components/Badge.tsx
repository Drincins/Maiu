import { cn } from '@/lib/cn'
import type { HTMLAttributes } from 'react'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  const styles: Record<string, string> = {
    neutral: 'border border-brand-200/60 bg-brand-50/70 text-brand-700',
    success: 'border border-emerald-200/60 bg-emerald-50 text-emerald-700',
    warning: 'border border-amber-200/60 bg-amber-50 text-amber-700',
    danger: 'border border-rose-200/60 bg-rose-50 text-rose-700',
    info: 'border border-sky-200/60 bg-sky-50 text-sky-700'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
        styles[tone],
        className
      )}
      {...props}
    />
  )
}
