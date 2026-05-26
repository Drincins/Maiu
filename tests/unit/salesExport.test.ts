import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SALES_EXPORT_COLUMNS,
  buildSalesExportRows
} from '../../src/lib/salesExport'

test('SALES_EXPORT_COLUMNS matches requested sales Excel column order', () => {
  assert.deepEqual(
    SALES_EXPORT_COLUMNS.map((column) => column.header),
    [
      '№',
      'Дата',
      'Клиент',
      'Телефон',
      'Город',
      'Служба доставки',
      'Трек номер',
      'Товар',
      'Кол-во',
      'Цена',
      'Стоимость',
      'Доставка',
      'Комментарий'
    ]
  )
})

test('buildSalesExportRows formats date without time and uses SKU as product value', () => {
  const rows = buildSalesExportRows([
    {
      id: 'order-1',
      ordered_at: '2026-05-24T22:30:00.000Z',
      customer_name: 'Анна',
      customer_phone: '+79990000000',
      city: 'Москва',
      delivery_service: 'СДЭК',
      tracking_number: 'TRACK-1',
      delivery_cost: 50000,
      note: 'Комментарий',
      sales_order_items: [
        {
          qty: 2,
          sku_snapshot: 'SKU-RED-M',
          unit_price_snapshot: 350000
        }
      ]
    }
  ])

  assert.deepEqual(rows, [
    {
      orderedAt: '25.05.2026',
      customerName: 'Анна',
      customerPhone: '+79990000000',
      city: 'Москва',
      deliveryService: 'СДЭК',
      trackingNumber: 'TRACK-1',
      product: 'SKU-RED-M',
      qty: 2,
      unitPrice: 3500,
      lineAmount: 7000,
      deliveryCost: 500,
      note: 'Комментарий'
    }
  ])
})
