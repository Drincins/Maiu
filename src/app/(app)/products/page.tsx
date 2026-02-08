import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import ProductListClient from './ProductListClient'

type ProductsPageProps = {
  searchParams?: Promise<{ view?: string }> | { view?: string }
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams
  const view =
    resolvedSearchParams?.view === 'archived' ? 'archived' : 'active'

  let query = supabase
    .from('product_models')
    .select('id, name, is_active, main_image_url, product_variants(size, unit_price, unit_cost)')
    .order('created_at', { ascending: false })

  query = query.eq('is_active', view === 'archived' ? false : true)

  const { data: models } = await query

  const toggleClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
      active
        ? 'border-brand-300 bg-brand-50 text-brand-700'
        : 'border-slate-200/70 bg-white/80 text-slate-600 hover:bg-slate-100/70'
    }`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Товары</h1>
          <p className="text-sm text-slate-500">Модели и их варианты SKU</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <Link href="/products" className={toggleClass(view === 'active')}>
              Активные
            </Link>
            <Link href="/products?view=archived" className={toggleClass(view === 'archived')}>
              Архивные
            </Link>
          </div>
          <Link href="/products/new">
            <Button>Добавить модель</Button>
          </Link>
        </div>
      </div>

      <Card>
        <ProductListClient models={models ?? []} />
      </Card>
    </div>
  )
}

