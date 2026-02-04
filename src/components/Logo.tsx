import { cn } from '@/lib/cn'

type LogoProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  subtitle?: string
}

const sizeStyles = {
  sm: {
    text: 'text-lg',
    tracking: 'tracking-[0.3em]',
    accent: 'h-[5px] w-12',
    accentPos: '-top-1.5 right-1'
  },
  md: {
    text: 'text-2xl',
    tracking: 'tracking-[0.28em]',
    accent: 'h-[6px] w-16',
    accentPos: '-top-2 right-2'
  },
  lg: {
    text: 'text-3xl',
    tracking: 'tracking-[0.26em]',
    accent: 'h-[7px] w-20',
    accentPos: '-top-2.5 right-2'
  }
} as const

export function Logo({ className, size = 'md', subtitle }: LogoProps) {
  const styles = sizeStyles[size]

  return (
    <div className={cn('flex flex-col items-start leading-none', className)}>
      <span
        className={cn(
          'relative inline-flex items-end font-brand uppercase text-brand-700',
          styles.text,
          styles.tracking
        )}
      >
        <span className="relative z-10">MAIU</span>
        <span
          aria-hidden
          className={cn(
            'absolute rounded-full bg-brand-600/90 shadow-[0_6px_16px_rgba(139,21,34,0.25)] rotate-12',
            styles.accent,
            styles.accentPos
          )}
        />
      </span>
      {subtitle ? (
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500">
          {subtitle}
        </span>
      ) : null}
    </div>
  )
}
