import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { toBusinessDateBoundaryIso } from '@/lib/businessDate'
import {
  SALES_ORDER_SOURCE_LABELS,
  getSalesStatusLabel,
  isSalesOrderStatus,
  type SalesOrderSource
} from '@/lib/sales'
import {
  SALES_EXPORT_COLUMNS,
  buildSalesExportRows,
  type SalesExportOrder
} from '@/lib/salesExport'

export const runtime = 'nodejs'

type SalesOrderItemRow = {
  qty: number
  sku_snapshot: string | null
  unit_price_snapshot: number | null
}

type SalesOrderRow = {
  id: string
  source: string
  status: string
  ordered_at: string
  customer_name: string | null
  customer_phone: string | null
  city: string | null
  delivery_service: string | null
  tracking_number: string | null
  delivery_cost: number | null
  note: string | null
  sales_order_items?: SalesOrderItemRow[] | null
}

const BRAND_HEADER = 'FF74121D'
const BRAND_BORDER = 'FFD7B1B7'
const RUB_NUMFMT = '#,##0.00 [$₽-419]'

const isSalesOrderSource = (value: string | null): value is SalesOrderSource =>
  value === 'manual' || value === 'operation' || value === 'tilda'

const sourceLabel = (source: string) =>
  SALES_ORDER_SOURCE_LABELS[source as SalesOrderSource] ?? source

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { session }
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const status = searchParams.get('status')
  const source = searchParams.get('source')
  const fromISO = toBusinessDateBoundaryIso(from, 'start')
  const toISO = toBusinessDateBoundaryIso(to, 'end')

  let query = supabase
    .from('sales_orders')
    .select(
      `
      id,
      source,
      status,
      ordered_at,
      customer_name,
      customer_phone,
      city,
      delivery_service,
      tracking_number,
      delivery_cost,
      note,
      sales_order_items (
        qty,
        sku_snapshot,
        unit_price_snapshot
      )
    `
    )
    .eq('user_id', user.id)
    .order('ordered_at', { ascending: false })
    .limit(5000)

  if (fromISO) query = query.gte('ordered_at', fromISO)
  if (toISO) query = query.lte('ordered_at', toISO)
  if (isSalesOrderStatus(status)) query = query.eq('status', status)
  if (isSalesOrderSource(source)) query = query.eq('source', source)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const orders = (data ?? []) as SalesOrderRow[]
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Maiu'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Продажи', {
    views: [{ state: 'frozen', ySplit: 1 }]
  })

  worksheet.columns = [...SALES_EXPORT_COLUMNS]

  const exportRows = buildSalesExportRows(orders as SalesExportOrder[])

  if (exportRows.length) {
    exportRows.forEach((row, index) => {
      worksheet.addRow({
        index: index + 1,
        ...row
      })
    })
  } else {
    worksheet.addRow({ index: 1, note: 'По выбранным фильтрам продаж не найдено' })
  }

  const totals = exportRows.reduce(
    (acc, row) => ({
      qty: acc.qty + row.qty,
      revenue: acc.revenue + row.lineAmount,
      delivery: acc.delivery + (row.deliveryCost ?? 0)
    }),
    { qty: 0, revenue: 0, delivery: 0 }
  )
  const resultAfterDelivery = totals.revenue - totals.delivery

  const totalsRow = worksheet.addRow({
    product: 'ИТОГО',
    qty: totals.qty,
    lineAmount: totals.revenue,
    deliveryCost: totals.delivery,
    note: `Итог без доставки: ${new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(resultAfterDelivery)}`
  })

  const headerRow = worksheet.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_HEADER }
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND_BORDER } },
      right: { style: 'thin', color: { argb: BRAND_BORDER } },
      bottom: { style: 'thin', color: { argb: BRAND_BORDER } },
      left: { style: 'thin', color: { argb: BRAND_BORDER } }
    }
  })

  worksheet.autoFilter = {
    from: 'A1',
    to: 'M1'
  }

  const currencyColumns = ['J', 'K', 'L']
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    row.height = 24
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE6E6E6' } },
        right: { style: 'thin', color: { argb: 'FFE6E6E6' } },
        bottom: { style: 'thin', color: { argb: 'FFE6E6E6' } },
        left: { style: 'thin', color: { argb: 'FFE6E6E6' } }
      }
    })
    currencyColumns.forEach((column) => {
      const cell = row.getCell(column)
      if (typeof cell.value === 'number') {
        cell.numFmt = RUB_NUMFMT
      }
    })
  }

  totalsRow.font = { bold: true }
  totalsRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9EEF0' }
    }
  })

  const summary = workbook.addWorksheet('Сводка')
  summary.columns = [
    { header: 'Показатель', key: 'name', width: 36 },
    { header: 'Значение', key: 'value', width: 24 }
  ]
  ;[
    { name: 'Сформировано', value: new Date().toLocaleString('ru-RU') },
    { name: 'Продаж', value: orders.length },
    { name: 'Строк товаров', value: exportRows.length },
    { name: 'Дата с', value: from || '—' },
    { name: 'Дата по', value: to || '—' },
    { name: 'Статус', value: isSalesOrderStatus(status) ? getSalesStatusLabel(status) : 'Все' },
    { name: 'Источник', value: isSalesOrderSource(source) ? sourceLabel(source) : 'Все' },
    { name: 'Выручка', value: totals.revenue },
    { name: 'Доставка', value: totals.delivery },
    { name: 'Итог без доставки', value: resultAfterDelivery }
  ].forEach((row) => summary.addRow(row))

  summary.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_HEADER }
    }
  })

  for (let rowNumber = 9; rowNumber <= 11; rowNumber += 1) {
    const cell = summary.getRow(rowNumber).getCell('B')
    if (typeof cell.value === 'number') {
      cell.numFmt = RUB_NUMFMT
      cell.font = { bold: true }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const dateSuffix = new Date().toISOString().slice(0, 10)

  return new NextResponse(buffer as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="sales_${dateSuffix}.xlsx"`
    }
  })
}
