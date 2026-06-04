import test from 'node:test'
import assert from 'node:assert/strict'
import {
  INVENTORY_EXPORT_COLUMNS,
  buildInventoryExportRows
} from '../../src/lib/inventoryExport'

test('INVENTORY_EXPORT_COLUMNS matches inventory Excel column order', () => {
  assert.deepEqual(
    INVENTORY_EXPORT_COLUMNS.map((column) => column.header),
    ['№', 'Товар', 'SKU', 'Размер', 'Цвет', 'Локация', 'Остаток', 'Маркировка', 'Активность']
  )
})

test('buildInventoryExportRows formats optional inventory values safely', () => {
  assert.deepEqual(
    buildInventoryExportRows([
      {
        variant: {
          sku: 'SKU-1',
          size: null,
          color: 'Черный',
          is_marked: true,
          model: {
            name: 'Кимоно',
            is_active: false
          }
        },
        location: {
          name: 'Склад Продажи'
        },
        qty: 7
      }
    ]),
    [
      {
        productName: 'Кимоно',
        sku: 'SKU-1',
        size: '—',
        color: 'Черный',
        locationName: 'Склад Продажи',
        qty: 7,
        marking: 'Да',
        active: 'Нет'
      }
    ]
  )
})
