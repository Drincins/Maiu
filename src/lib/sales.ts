export const SALES_ORDER_STATUSES = [
  'imported',
  'needs_confirmation',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'return_requested',
  'returned_to_stock',
  'refund_pending',
  'refunded',
  'cancelled',
  'problem'
] as const

export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number]
export type SalesOrderSource = 'manual' | 'operation' | 'tilda'
export type SalesStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  imported: 'Загружен',
  needs_confirmation: 'Нужно подтвердить',
  confirmed: 'Подтвержден',
  packed: 'Собран',
  shipped: 'Отправлен',
  delivered: 'Доставлен',
  return_requested: 'Запрошен возврат',
  returned_to_stock: 'Возврат поступил',
  refund_pending: 'Возврат денег',
  refunded: 'Деньги возвращены',
  cancelled: 'Отменен',
  problem: 'Проблема'
}

const SALES_ORDER_STATUS_SET = new Set<string>(SALES_ORDER_STATUSES)

export function isSalesOrderStatus(value: unknown): value is SalesOrderStatus {
  return typeof value === 'string' && SALES_ORDER_STATUS_SET.has(value)
}

export function getSalesStatusLabel(status: SalesOrderStatus) {
  return SALES_ORDER_STATUS_LABELS[status]
}

export function getSalesStatusTone(status: SalesOrderStatus): SalesStatusTone {
  if (status === 'delivered' || status === 'refunded') return 'success'
  if (
    status === 'needs_confirmation' ||
    status === 'return_requested' ||
    status === 'refund_pending'
  ) {
    return 'warning'
  }
  if (status === 'cancelled' || status === 'problem') return 'danger'
  if (status === 'shipped' || status === 'packed' || status === 'confirmed') return 'info'
  return 'neutral'
}

export const SALES_ORDER_SOURCE_LABELS: Record<SalesOrderSource, string> = {
  manual: 'Вручную',
  operation: 'Операция',
  tilda: 'Tilda'
}
