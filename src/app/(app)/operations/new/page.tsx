import { createClient } from '@/lib/supabase/server'
import OperationForm from '../OperationForm'

export default async function NewOperationPage() {
  const supabase = await createClient()
  const [{ data: variants }, { data: locations }, { data: promoCodes }] =
    await Promise.all([
      supabase
        .from('product_variants')
        .select('id, sku, size, color, unit_price, unit_cost, is_marked')
        .order('created_at', { ascending: false }),
      supabase.from('locations').select('id, name, type').order('created_at'),
      supabase.from('promo_codes').select('id, code').order('created_at')
    ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Новая операция</h1>
        <p className="text-sm text-slate-500">
          Любая операция создает движения по складу
        </p>
      </div>
      <OperationForm
        variants={variants ?? []}
        locations={locations ?? []}
        promoCodes={promoCodes ?? []}
      />
    </div>
  )
}
