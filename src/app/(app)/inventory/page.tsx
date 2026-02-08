import { createClient } from '@/lib/supabase/server'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const supabase = await createClient()

  const [{ data: stock }, { data: variants }, { data: locations }] =
    await Promise.all([
      supabase.from('v_stock_on_hand').select('variant_id, location_id, qty'),
      supabase
        .from('product_variants')
        .select('id, sku, size, color, is_marked, model_id, model:product_models(name, is_active)'),
      supabase.from('locations').select('id, name, type')
    ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Остатки</h1>
        <p className="text-sm text-slate-500">Рассчитываются из движений склада</p>
      </div>
      <InventoryClient
        stock={stock ?? []}
        variants={(variants as any) ?? []}
        locations={locations ?? []}
      />
    </div>
  )
}

