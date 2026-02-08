import { cn } from '@/lib/cn'
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

type TableProps = HTMLAttributes<HTMLTableElement>

type SectionProps = HTMLAttributes<HTMLTableSectionElement>

type CellProps = TdHTMLAttributes<HTMLTableCellElement>
type HeaderCellProps = ThHTMLAttributes<HTMLTableCellElement>

type RowProps = HTMLAttributes<HTMLTableRowElement>

export function Table({ className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}

export function THead({ className, ...props }: SectionProps) {
  return (
    <thead
      className={cn('bg-slate-100/80 text-left backdrop-blur', className)}
      {...props}
    />
  )
}

export function TBody({ className, ...props }: SectionProps) {
  return <tbody className={className} {...props} />
}

export function TH({ className, ...props }: HeaderCellProps) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700',
        className
      )}
      {...props}
    />
  )
}

export function TD({ className, ...props }: CellProps) {
  return (
    <td className={cn('px-4 py-3 text-sm text-slate-800', className)} {...props} />
  )
}

export function TR({ className, ...props }: RowProps) {
  return (
    <tr
      className={cn(
        'border-b border-slate-200/70 last:border-b-0 hover:bg-brand-50/40',
        className
      )}
      {...props}
    />
  )
}
