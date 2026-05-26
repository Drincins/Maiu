import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SALES_ORDER_STATUSES,
  getSalesStatusLabel,
  isSalesOrderStatus
} from '../../src/lib/sales'

test('SALES_ORDER_STATUSES keeps the full CRM status lifecycle in order', () => {
  assert.deepEqual(SALES_ORDER_STATUSES, [
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
  ])
})

test('getSalesStatusLabel returns Russian labels for sale statuses', () => {
  assert.equal(getSalesStatusLabel('imported'), 'Загружен')
  assert.equal(getSalesStatusLabel('shipped'), 'Отправлен')
  assert.equal(getSalesStatusLabel('returned_to_stock'), 'Возврат поступил')
})

test('isSalesOrderStatus validates unknown external values safely', () => {
  assert.equal(isSalesOrderStatus('confirmed'), true)
  assert.equal(isSalesOrderStatus('unknown'), false)
  assert.equal(isSalesOrderStatus(null), false)
})
