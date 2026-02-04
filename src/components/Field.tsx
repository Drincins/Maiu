import type { ReactNode } from 'react'

type FieldProps = {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}

export function Field({ label, error, hint, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  )
}
