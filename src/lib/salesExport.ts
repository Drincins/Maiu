export type SalesExportItem = {
  qty: number
  sku_snapshot: string | null
  unit_price_snapshot: number | null
}

export type SalesExportOrder = {
  id: string
  ordered_at: string
  customer_name: string | null
  customer_phone: string | null
  city: string | null
  delivery_service: string | null
  tracking_number: string | null
  delivery_cost: number | null
  note: string | null
  sales_order_items?: SalesExportItem[] | null
}

export type SalesExportRow = {
  orderedAt: string
  customerName: string
  customerPhone: string
  city: string
  deliveryService: string
  trackingNumber: string
  product: string
  qty: number
  unitPrice: number
  lineAmount: number
  deliveryCost: number | null
  note: string
}

export const SALES_EXPORT_COLUMNS = [
  { header: '№', key: 'index', width: 6 },
  { header: 'Дата', key: 'orderedAt', width: 14 },
  { header: 'Клиент', key: 'customerName', width: 24 },
  { header: 'Телефон', key: 'customerPhone', width: 18 },
  { header: 'Город', key: 'city', width: 18 },
  { header: 'Служба доставки', key: 'deliveryService', width: 20 },
  { header: 'Трек номер', key: 'trackingNumber', width: 22 },
  { header: 'Товар', key: 'product', width: 22 },
  { header: 'Кол-во', key: 'qty', width: 10 },
  { header: 'Цена', key: 'unitPrice', width: 14 },
  { header: 'Стоимость', key: 'lineAmount', width: 16 },
  { header: 'Доставка', key: 'deliveryCost', width: 14 },
  { header: 'Комментарий', key: 'note', width: 32 }
] as const

const toRub = (kopecks: number | null | undefined) => (kopecks ?? 0) / 100

const formatDateOnly = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow'
  }).format(new Date(value))

export function buildSalesExportRows(orders: SalesExportOrder[]): SalesExportRow[] {
  return orders.flatMap((order) => {
    const items = order.sales_order_items?.length ? order.sales_order_items : [null]

    return items.map((item, itemIndex) => {
      const qty = item?.qty ?? 0
      const unitPrice = toRub(item?.unit_price_snapshot)

      return {
        orderedAt: formatDateOnly(order.ordered_at),
        customerName: order.customer_name ?? '—',
        customerPhone: order.customer_phone ?? '—',
        city: order.city ?? '—',
        deliveryService: order.delivery_service ?? '—',
        trackingNumber: order.tracking_number ?? '—',
        product: item?.sku_snapshot ?? '—',
        qty,
        unitPrice,
        lineAmount: qty * unitPrice,
        deliveryCost: itemIndex === 0 ? toRub(order.delivery_cost) : null,
        note: order.note ?? ''
      }
    })
  })
}
