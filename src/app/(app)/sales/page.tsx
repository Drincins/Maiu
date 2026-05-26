import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import SalesTableClient from './SalesTableClient'

type SalesOrderItemRow = {
  qty: number
  product_name_snapshot: string | null
  sku_snapshot: string | null
  unit_price_snapshot: number | null
  unit_cost_snapshot: number | null
}

type SalesOrderRow = {
  id: string
  source: string
  source_external_id: string | null
  status: string
  status_changed_at: string
  ordered_at: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  city: string | null
  delivery_service: string | null
  tracking_number: string | null
  delivery_cost: number | null
  total_amount: number | null
  paid_amount: number | null
  note: string | null
  sales_order_items?: SalesOrderItemRow[] | null
}

export default async function SalesPage() {
  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('sales_orders')
    .select(
      `
      id,
      source,
      source_external_id,
      status,
      status_changed_at,
      ordered_at,
      customer_name,
      customer_phone,
      customer_email,
      city,
      delivery_service,
      tracking_number,
      delivery_cost,
      total_amount,
      paid_amount,
      note,
      sales_order_items (
        qty,
        product_name_snapshot,
        sku_snapshot,
        unit_price_snapshot,
        unit_cost_snapshot
      )
    `
    )
    .order('ordered_at', { ascending: false })
    .limit(1000)

  const rows = (orders ?? []) as SalesOrderRow[]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Продажи</h1>
        <p className="text-sm text-slate-500">
          CRM-журнал заказов, статусов, доставок и возвратов
        </p>
      </div>

      <Card>
        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            Ошибка загрузки продаж: {error.message}
          </div>
        ) : null}
        <SalesTableClient orders={rows} />
      </Card>
    </div>
  )
}
