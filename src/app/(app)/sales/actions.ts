'use server'

import { createClient } from '@/lib/supabase/server'
import { isSalesOrderStatus, type SalesOrderStatus } from '@/lib/sales'

type SalesOrderItemForReturn = {
  operation_line_id: string | null
  variant_id: string | null
  qty: number
  unit_price_snapshot: number | null
}

type SalesOrderForReturn = {
  id: string
  user_id: string
  status: string
  operation_id: string | null
  city: string | null
  delivery_cost: number | null
  delivery_service: string | null
  tracking_number: string | null
  note: string | null
  sales_order_items?: SalesOrderItemForReturn[] | null
}

type ProductVariantForReturn = {
  id: string
  is_marked: boolean
}

type MarkCodeForReturn = {
  variant_id: string | null
  code: string
}

type OperationLineForReturn = {
  id: string
  line_note: string | null
}

const MARKING_NOTE = '[MARKING_NOT_HANDLED]'

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

export async function createSalesReturn(orderId: string) {
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
    .select(
      `
      id,
      user_id,
      status,
      operation_id,
      city,
      delivery_cost,
      delivery_service,
      tracking_number,
      note,
      sales_order_items (
        operation_line_id,
        variant_id,
        qty,
        unit_price_snapshot
      )
    `
    )
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (orderError) return { error: orderError.message }
  if (!order) return { error: 'Продажа не найдена' }

  const orderRow = order as SalesOrderForReturn
  if (
    orderRow.status === 'returned_to_stock' ||
    orderRow.status === 'refunded' ||
    orderRow.status === 'cancelled'
  ) {
    return { error: 'Для этой продажи возврат уже закрыт или недоступен' }
  }

  const items = orderRow.sales_order_items ?? []
  if (!items.length) {
    return { error: 'В продаже нет товаров для возврата' }
  }

  if (items.some((item) => !item.variant_id)) {
    return { error: 'В продаже есть товар без SKU. Оформите возврат через операции' }
  }

  const variantIds = Array.from(
    new Set(items.map((item) => item.variant_id).filter((id): id is string => Boolean(id)))
  )
  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, is_marked')
    .eq('user_id', user.id)
    .in('id', variantIds)

  if (variantsError) return { error: variantsError.message }

  const markedVariantIds = new Set(
    ((variants ?? []) as ProductVariantForReturn[])
      .filter((variant) => variant.is_marked)
      .map((variant) => variant.id)
  )
  const codesByVariant = new Map<string, string[]>()
  const markingNotHandledLineIds = new Set<string>()

  if (markedVariantIds.size) {
    if (!orderRow.operation_id) {
      return {
        error:
          'В продаже есть маркированные товары. Быстрый возврат доступен только для продаж из операции'
      }
    }

    const { data: markCodes, error: markCodesError } = await supabase
      .from('mark_codes')
      .select('variant_id, code')
      .eq('user_id', user.id)
      .eq('last_operation_id', orderRow.operation_id)
      .in('variant_id', Array.from(markedVariantIds))

    if (markCodesError) return { error: markCodesError.message }

    const operationLineIds = items
      .map((item) => item.operation_line_id)
      .filter((id): id is string => Boolean(id))

    if (operationLineIds.length) {
      const { data: operationLines, error: operationLinesError } = await supabase
        .from('operation_lines')
        .select('id, line_note')
        .eq('operation_id', orderRow.operation_id)
        .in('id', operationLineIds)

      if (operationLinesError) return { error: operationLinesError.message }

      ;((operationLines ?? []) as OperationLineForReturn[]).forEach((line) => {
        if (line.line_note?.includes(MARKING_NOTE)) {
          markingNotHandledLineIds.add(line.id)
        }
      })
    }

    ;((markCodes ?? []) as MarkCodeForReturn[]).forEach((markCode) => {
      if (!markCode.variant_id) return
      const existing = codesByVariant.get(markCode.variant_id) ?? []
      existing.push(markCode.code)
      codesByVariant.set(markCode.variant_id, existing)
    })
  }

  const lines = items.map((item) => {
    const variantId = item.variant_id as string
    const markingNotHandled = item.operation_line_id
      ? markingNotHandledLineIds.has(item.operation_line_id)
      : false
    const markCodes = markedVariantIds.has(variantId) && !markingNotHandled
      ? (codesByVariant.get(variantId) ?? []).splice(0, Number(item.qty ?? 0))
      : []

    return {
      variant_id: variantId,
      qty: Number(item.qty ?? 0),
      unit_price_snapshot: item.unit_price_snapshot ?? undefined,
      mark_codes: markCodes,
      marking_not_handled: markingNotHandled || undefined
    }
  })

  const invalidMarkedLine = lines.find(
    (line) =>
      markedVariantIds.has(line.variant_id) &&
      !line.marking_not_handled &&
      line.mark_codes.length !== line.qty
  )
  if (invalidMarkedLine) {
    return {
      error:
        'Не удалось найти все коды маркировки для быстрого возврата. Оформите возврат через операцию продажи'
    }
  }

  const note = orderRow.note
    ? `Возврат по продаже ${orderRow.id}: ${orderRow.note}`
    : `Возврат по продаже ${orderRow.id}`

  // The return operation moves stock; the original sales order is updated below.
  const { data: operationId, error: operationError } = await supabase.rpc('create_operation', {
    payload: {
      type: 'sale_return',
      occurred_at: new Date().toISOString(),
      city: orderRow.city,
      delivery_cost: orderRow.delivery_cost ?? null,
      delivery_service: orderRow.delivery_service,
      tracking_number: orderRow.tracking_number,
      note,
      lines
    }
  })

  if (operationError) return { error: operationError.message }

  const changedAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('sales_orders')
    .update({
      status: 'returned_to_stock',
      status_changed_at: changedAt,
      returned_at: changedAt
    })
    .eq('id', orderRow.id)
    .eq('user_id', user.id)

  if (updateError) return { error: updateError.message }

  const { error: historyError } = await supabase.from('sales_status_history').insert({
    user_id: user.id,
    sales_order_id: orderRow.id,
    from_status: orderRow.status,
    to_status: 'returned_to_stock',
    changed_at: changedAt,
    note: operationId ? `Создана операция возврата ${operationId}` : 'Создана операция возврата'
  })

  if (historyError) return { error: historyError.message }

  return {
    ok: true,
    operationId: operationId as string | null,
    status: 'returned_to_stock' as const,
    changedAt
  }
}
