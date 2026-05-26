type SupabaseLike = {
  from(table: string): any
}

type OperationRow = {
  id: string
  user_id: string
  type: string
  occurred_at: string
  city: string | null
  delivery_cost: number | null
  delivery_service: string | null
  tracking_number: string | null
  note: string | null
}

type ProductModelRelation = { name: string | null } | Array<{ name: string | null }> | null
type ProductVariantRelation =
  | {
      sku: string | null
      product_models?: ProductModelRelation
    }
  | Array<{
      sku: string | null
      product_models?: ProductModelRelation
    }>
  | null

type OperationLineRow = {
  id: string
  variant_id: string
  qty: number
  unit_price_snapshot: number | null
  unit_cost_snapshot: number | null
  product_variants?: ProductVariantRelation
}

const SALE_OPERATION_TYPES = new Set(['sale', 'sale_return'])

const firstRelation = <T>(value: T | T[] | null | undefined) => {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

const getOperationStatus = (type: string) =>
  type === 'sale_return' ? 'returned_to_stock' : 'delivered'

export async function deleteSalesOrderForOperation(
  supabase: SupabaseLike,
  operationId: string
) {
  const { error } = await supabase
    .from('sales_orders')
    .delete()
    .eq('source', 'operation')
    .eq('source_external_id', operationId)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function syncSalesOrderFromOperation(
  supabase: SupabaseLike,
  operationId: string
) {
  const { data: operation, error: operationError } = await supabase
    .from('operations')
    .select(
      'id, user_id, type, occurred_at, city, delivery_cost, delivery_service, tracking_number, note'
    )
    .eq('id', operationId)
    .maybeSingle()

  if (operationError) return { error: operationError.message }
  if (!operation) return { error: 'Operation not found' }

  const operationRow = operation as OperationRow

  if (!SALE_OPERATION_TYPES.has(operationRow.type)) {
    return deleteSalesOrderForOperation(supabase, operationId)
  }

  const { data: lines, error: linesError } = await supabase
    .from('operation_lines')
    .select(
      `
      id,
      variant_id,
      qty,
      unit_price_snapshot,
      unit_cost_snapshot,
      product_variants (
        sku,
        product_models (
          name
        )
      )
    `
    )
    .eq('operation_id', operationId)
    .order('created_at')

  if (linesError) return { error: linesError.message }

  const lineRows = (lines ?? []) as OperationLineRow[]
  const totalAmount = lineRows.reduce(
    (sum, line) => sum + (line.unit_price_snapshot ?? 0) * line.qty,
    0
  )

  const { data: existingOrder, error: existingError } = await supabase
    .from('sales_orders')
    .select('id, status')
    .eq('source', 'operation')
    .eq('source_external_id', operationId)
    .maybeSingle()

  if (existingError) return { error: existingError.message }

  const status = getOperationStatus(operationRow.type)
  const orderPayload = {
    user_id: operationRow.user_id,
    source: 'operation',
    source_external_id: operationId,
    source_payload: { operation_type: operationRow.type },
    operation_id: operationId,
    status,
    status_changed_at: operationRow.occurred_at,
    ordered_at: operationRow.occurred_at,
    city: operationRow.city,
    delivery_service: operationRow.delivery_service,
    tracking_number: operationRow.tracking_number,
    delivery_cost: operationRow.delivery_cost ?? 0,
    total_amount: totalAmount,
    paid_amount: totalAmount,
    delivered_at: operationRow.type === 'sale' ? operationRow.occurred_at : null,
    returned_at: operationRow.type === 'sale_return' ? operationRow.occurred_at : null,
    note: operationRow.note
  }

  let orderId = existingOrder?.id as string | undefined

  if (orderId) {
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update(orderPayload)
      .eq('id', orderId)
      .eq('user_id', operationRow.user_id)

    if (updateError) return { error: updateError.message }
  } else {
    const { data: insertedOrder, error: insertError } = await supabase
      .from('sales_orders')
      .insert(orderPayload)
      .select('id')
      .single()

    if (insertError) return { error: insertError.message }
    orderId = insertedOrder.id
  }

  const { error: deleteItemsError } = await supabase
    .from('sales_order_items')
    .delete()
    .eq('sales_order_id', orderId)
    .eq('user_id', operationRow.user_id)

  if (deleteItemsError) return { error: deleteItemsError.message }

  if (lineRows.length) {
    const { error: insertItemsError } = await supabase.from('sales_order_items').insert(
      lineRows.map((line) => {
        const variant = firstRelation(line.product_variants)
        const model = firstRelation(variant?.product_models)

        return {
          user_id: operationRow.user_id,
          sales_order_id: orderId,
          operation_line_id: line.id,
          variant_id: line.variant_id,
          product_name_snapshot: model?.name ?? null,
          sku_snapshot: variant?.sku ?? null,
          qty: line.qty,
          unit_price_snapshot: line.unit_price_snapshot ?? 0,
          unit_cost_snapshot: line.unit_cost_snapshot ?? 0
        }
      })
    )

    if (insertItemsError) return { error: insertItemsError.message }
  }

  return { id: orderId }
}
