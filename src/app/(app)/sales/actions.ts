'use server'

import { createClient } from '@/lib/supabase/server'
import { isSalesOrderStatus, type SalesOrderStatus } from '@/lib/sales'

const timestampColumnByStatus: Partial<Record<SalesOrderStatus, string>> = {
  confirmed: 'confirmed_at',
  packed: 'packed_at',
  shipped: 'shipped_at',
  delivered: 'delivered_at',
  returned_to_stock: 'returned_at',
  refunded: 'refunded_at'
}

export async function updateSalesOrderStatus(
  orderId: string,
  status: string,
  note?: string | null
) {
  if (!isSalesOrderStatus(status)) {
    return { error: 'Некорректный статус продажи' }
  }

  const supabase = await createClient()
  const {
    data: { session }
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: order, error: orderError } = await supabase
    .from('sales_orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (orderError) return { error: orderError.message }
  if (!order) return { error: 'Продажа не найдена' }

  const changedAt = new Date().toISOString()
  const patch: Record<string, string> = {
    status,
    status_changed_at: changedAt
  }
  const timestampColumn = timestampColumnByStatus[status]
  if (timestampColumn) {
    patch[timestampColumn] = changedAt
  }

  const { error: updateError } = await supabase
    .from('sales_orders')
    .update(patch)
    .eq('id', orderId)
    .eq('user_id', user.id)

  if (updateError) return { error: updateError.message }

  const { error: historyError } = await supabase.from('sales_status_history').insert({
    user_id: user.id,
    sales_order_id: orderId,
    from_status: order.status,
    to_status: status,
    changed_at: changedAt,
    note: note?.trim() || null
  })

  if (historyError) return { error: historyError.message }

  return { ok: true }
}
