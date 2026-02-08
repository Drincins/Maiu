import { redirect } from 'next/navigation'

type ReportsPageProps = {
  searchParams?:
    | Promise<{ from?: string; to?: string; report?: string }>
    | { from?: string; to?: string; report?: string }
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const resolvedSearchParams = await searchParams
  const params = new URLSearchParams()
  if (resolvedSearchParams?.from) params.set('from', resolvedSearchParams.from)
  if (resolvedSearchParams?.to) params.set('to', resolvedSearchParams.to)
  if (resolvedSearchParams?.report) params.set('report', resolvedSearchParams.report)

  const suffix = params.toString()
  redirect(suffix ? `/dashboard?${suffix}` : '/dashboard')
}
