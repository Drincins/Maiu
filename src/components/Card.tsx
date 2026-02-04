import { cn } from '@/lib/cn'
import type { HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_18px_45px_rgba(27,27,27,0.08)] backdrop-blur',
        className
      )}
      {...props}
    />
  )
}
