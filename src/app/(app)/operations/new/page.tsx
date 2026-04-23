import { createClient } from '@/lib/supabase/server'
import OperationForm from '../OperationForm'

export default async function NewOperationPage() {
  const supabase = await createClient()
  const [
    { data: variants, error: variantsError },
    { data: locations, error: locationsError },
    { data: promoCodes, error: promoCodesError }
  ] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, sku, size, color, unit_price, unit_cost, is_marked')
      .order('created_at', { ascending: false }),
    supabase.from('locations').select('id, name, type').order('created_at'),
    supabase.from('promo_codes').select('id, code').order('created_at')
  ])

  const preloadError = variantsError ?? locationsError ?? promoCodesError

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Новая операция</h1>
        <p className="text-sm text-slate-500">
          Любая операция создает движения по складу
        </p>
      </div>
      {preloadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
          Часть справочников не загрузилась: {preloadError.message}
        </div>
      ) : null}
      <OperationForm
        variants={variants ?? []}
        locations={locations ?? []}
        promoCodes={promoCodes ?? []}
      />
    </div>
  )
}
