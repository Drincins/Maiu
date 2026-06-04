export type InventoryExportRowInput = {
  variant: {
    sku: string
    size: string | null
    color: string | null
    is_marked: boolean
    model?: {
      name: string | null
      is_active: boolean
    } | null
  }
  location: {
    name: string
  }
  qty: number
}

export type InventoryExportRow = {
  productName: string
  sku: string
  size: string
  color: string
  locationName: string
  qty: number
  marking: string
  active: string
}

export const INVENTORY_EXPORT_COLUMNS = [
  { header: '№', key: 'index', width: 6 },
  { header: 'Товар', key: 'productName', width: 30 },
  { header: 'SKU', key: 'sku', width: 18 },
  { header: 'Размер', key: 'size', width: 12 },
  { header: 'Цвет', key: 'color', width: 18 },
  { header: 'Локация', key: 'locationName', width: 22 },
  { header: 'Остаток', key: 'qty', width: 12 },
  { header: 'Маркировка', key: 'marking', width: 14 },
  { header: 'Активность', key: 'active', width: 14 }
]

export function buildInventoryExportRows(
  rows: InventoryExportRowInput[]
): InventoryExportRow[] {
  return rows.map((row) => ({
    productName: row.variant.model?.name ?? '—',
    sku: row.variant.sku,
    size: row.variant.size ?? '—',
    color: row.variant.color ?? '—',
    locationName: row.location.name,
    qty: row.qty,
    marking: row.variant.is_marked ? 'Да' : 'Нет',
    active: row.variant.model?.is_active === false ? 'Нет' : 'Да'
  }))
}
