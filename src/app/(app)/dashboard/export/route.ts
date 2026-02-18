import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import {
  DASHBOARD_SETTINGS_DEFAULTS,
  DASHBOARD_SETTINGS_SELECT,
  normalizeDashboardSettings
} from '../settings'

export const runtime = 'nodejs'

type OperationLine = {
  qty: number
  unit_price_snapshot: number | null
  unit_cost_snapshot: number | null
}

type OperationRow = {
  id: string
  occurred_at: string
  type?: string
  delivery_cost?: number | null
  promo_code_snapshot?: string | null
  discount_type_snapshot?: string | null
  discount_value_snapshot?: number | null
  city?: string | null
  operation_lines?: OperationLine[]
}

type FinanceRow = {
  id: string
  occurred_at: string
  type: 'income' | 'expense'
  amount: number
  operation_id?: string | null
  note?: string | null
  category?: { name: string | null } | null
  payment_source?: { name: string | null } | null
}

const toRuDateTime = (value: string | null | undefined) => {
  if (!value) return ''
  return new Date(value).toLocaleString('ru-RU')
}

const toBoundaryIso = (value: string | null, boundary: 'start' | 'end') => {
  if (!value) return null
  const source = boundary === 'start' ? `${value}T00:00:00` : `${value}T23:59:59.999`
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const toRub = (kopecks: number | null | undefined) => (kopecks ?? 0) / 100

const operationTypeLabel = (type?: string | null) => {
  switch (type) {
    case 'sale':
      return 'Продажа'
    case 'sale_return':
      return 'Возврат продажи'
    case 'ship_blogger':
      return 'Отправка блогеру'
    case 'return_blogger':
      return 'Возврат от блогера'
    default:
      return type ?? 'Операция'
  }
}

const calculateDiscount = (revenue: number, type?: string | null, value?: number | null) => {
  const normalizedRevenue = Math.max(0, revenue)
  const rawValue = Math.max(0, value ?? 0)

  if (!normalizedRevenue || !rawValue) return 0

  if (type === 'percent') {
    const boundedPercent = Math.min(100, rawValue)
    return Math.round((normalizedRevenue * boundedPercent) / 100)
  }

  const fixedDiscountInKopecks = rawValue * 100
  return Math.min(fixedDiscountInKopecks, normalizedRevenue)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const scope = searchParams.get('scope')
  const isAllTime = scope === 'all'
  const today = new Date().toISOString().slice(0, 10)
  const from = isAllTime ? null : (searchParams.get('from') || today)
  const to = isAllTime ? null : (searchParams.get('to') || today)
  const fromISO = toBoundaryIso(from, 'start')
  const toISO = toBoundaryIso(to, 'end')

  const applyDateFilter = (query: any) => {
    let next = query
    if (fromISO) next = next.gte('occurred_at', fromISO)
    if (toISO) next = next.lte('occurred_at', toISO)
    return next
  }

  const [
    { data: salesOps },
    { data: bloggerOps },
    { data: finance },
    { data: rawDashboardSettings, error: dashboardSettingsError }
  ] = await Promise.all([
    applyDateFilter(
      supabase
        .from('operations')
        .select(
          'id, occurred_at, type, city, delivery_cost, promo_code_snapshot, discount_type_snapshot, discount_value_snapshot, operation_lines(qty, unit_price_snapshot, unit_cost_snapshot)'
        )
        .in('type', ['sale', 'sale_return'])
    ),
    applyDateFilter(
      supabase
        .from('operations')
        .select('id, occurred_at, type, delivery_cost, operation_lines(qty, unit_cost_snapshot)')
        .in('type', ['ship_blogger', 'return_blogger'])
    ),
    applyDateFilter(
      supabase
        .from('finance_transactions')
        .select(
          'id, occurred_at, type, amount, operation_id, note, category:category_id(name), payment_source:payment_source_id(name)'
        )
    ),
    supabase
      .from('dashboard_settings')
      .select(DASHBOARD_SETTINGS_SELECT)
      .maybeSingle()
  ])

  const dashboardSettings = dashboardSettingsError
    ? DASHBOARD_SETTINGS_DEFAULTS
    : normalizeDashboardSettings(rawDashboardSettings)

  const salesRows = ((salesOps as OperationRow[] | null | undefined) ?? []).map((op) => {
    const isSaleReturn = op.type === 'sale_return'
    const sign = isSaleReturn ? -1 : 1
    const lines = op.operation_lines ?? []
    const qty = lines.reduce((sum, line) => sum + (line.qty ?? 0), 0)
    const grossRevenue = lines.reduce(
      (sum, line) => sum + (line.unit_price_snapshot ?? 0) * line.qty,
      0
    )
    const cost = lines.reduce(
      (sum, line) => sum + (line.unit_cost_snapshot ?? 0) * line.qty,
      0
    )
    const discount = calculateDiscount(
      grossRevenue,
      op.discount_type_snapshot,
      op.discount_value_snapshot
    )
    const netRevenue = Math.max(0, grossRevenue - discount)
    const delivery = op.delivery_cost ?? 0

    return {
      id: op.id,
      occurred_at: op.occurred_at,
      type: isSaleReturn ? 'sale_return' : 'sale',
      city: op.city ?? null,
      promo_code: op.promo_code_snapshot ?? null,
      qty: qty * sign,
      gross_revenue: grossRevenue,
      discount_value: discount,
      net_revenue: netRevenue,
      cost_value: cost,
      delivery_value: delivery,
      net_revenue_signed: netRevenue * sign,
      cost_signed: cost * sign,
      discount_signed: discount * sign,
      delivery_signed: delivery * sign
    }
  })

  const bloggerRows = ((bloggerOps as OperationRow[] | null | undefined) ?? []).map((op) => {
    const lines = op.operation_lines ?? []
    const qty = lines.reduce((sum, line) => sum + (line.qty ?? 0), 0)
    const cost = lines.reduce(
      (sum, line) => sum + (line.unit_cost_snapshot ?? 0) * line.qty,
      0
    )

    return {
      id: op.id,
      occurred_at: op.occurred_at,
      type: op.type ?? 'ship_blogger',
      qty,
      cost,
      delivery: op.delivery_cost ?? 0
    }
  })

  const financeRows = (finance as FinanceRow[] | null | undefined) ?? []
  const incomeRows = financeRows.filter((row) => row.type === 'income')
  const expenseRows = financeRows.filter((row) => row.type === 'expense')

  const saleOnlyRows = salesRows.filter((row) => row.type === 'sale')
  const salesReturnRows = salesRows.filter((row) => row.type === 'sale_return')
  const shipRows = bloggerRows.filter((row) => row.type === 'ship_blogger')
  const bloggerReturnRows = bloggerRows.filter((row) => row.type === 'return_blogger')

  const salesGrossRevenueOnly = saleOnlyRows.reduce((sum, row) => sum + row.gross_revenue, 0)
  const salesDiscountOnly = saleOnlyRows.reduce((sum, row) => sum + row.discount_value, 0)
  const salesReturnsNet = salesReturnRows.reduce((sum, row) => sum + row.net_revenue, 0)
  const salesCostOnly = saleOnlyRows.reduce((sum, row) => sum + row.cost_value, 0)
  const salesReturnCostRecovery = salesReturnRows.reduce(
    (sum, row) => sum + row.cost_value,
    0
  )
  const salesDeliveryExpense = salesRows.reduce((sum, row) => sum + row.delivery_value, 0)
  const shipCost = shipRows.reduce((sum, row) => sum + row.cost, 0)
  const shipDelivery = shipRows.reduce((sum, row) => sum + row.delivery, 0)
  const bloggerReturnCost = bloggerReturnRows.reduce((sum, row) => sum + row.cost, 0)
  const bloggerReturnDelivery = bloggerReturnRows.reduce((sum, row) => sum + row.delivery, 0)
  const bloggerDeliveryExpense = shipDelivery + bloggerReturnDelivery
  const incomeTotal = incomeRows.reduce((sum, row) => sum + row.amount, 0)
  const expenseTotal = expenseRows.reduce((sum, row) => sum + row.amount, 0)
  const incomeWithoutLinkedOperations = incomeRows
    .filter((row) => !row.operation_id)
    .reduce((sum, row) => sum + row.amount, 0)
  const managementIncome =
    dashboardSettings.sales_revenue_source === 'operations'
      ? incomeWithoutLinkedOperations
      : incomeTotal

  const managementPlusLines = [
    {
      component:
        dashboardSettings.sales_revenue_source === 'operations'
          ? 'Доходы (финансы, без привязки к операциям)'
          : 'Доходы (финансы)',
      amount: managementIncome,
      enabled: dashboardSettings.include_finance_income
    },
    {
      component: 'Выручка с продаж (до скидок)',
      amount: salesGrossRevenueOnly,
      enabled:
        dashboardSettings.include_sales_revenue &&
        dashboardSettings.sales_revenue_source === 'operations'
    },
    {
      component: 'Возврат себестоимости (возвраты продаж)',
      amount: salesReturnCostRecovery,
      enabled: dashboardSettings.include_sales_return_cost_recovery
    },
    {
      component: 'Возвраты от блогеров (себестоимость)',
      amount: bloggerReturnCost,
      enabled: dashboardSettings.include_blogger_return_recovery
    }
  ].filter((line) => line.enabled)

  const managementMinusLines = [
    {
      component: 'Расходы (финансы)',
      amount: expenseTotal,
      enabled: dashboardSettings.include_finance_expense
    },
    {
      component: 'Возвраты клиентам (нетто)',
      amount: salesReturnsNet,
      enabled: dashboardSettings.include_sale_returns
    },
    {
      component: 'Потери на скидках',
      amount: salesDiscountOnly,
      enabled: dashboardSettings.include_sales_discounts
    },
    {
      component: 'Доставка продаж и возвратов',
      amount: salesDeliveryExpense,
      enabled: dashboardSettings.include_sales_delivery
    },
    {
      component: 'Себестоимость проданных товаров',
      amount: salesCostOnly,
      enabled: dashboardSettings.include_sales_cogs
    },
    {
      component: 'Отправки блогерам (себестоимость)',
      amount: shipCost,
      enabled: dashboardSettings.include_blogger_ship_cost
    },
    {
      component: 'Доставка блогерам',
      amount: bloggerDeliveryExpense,
      enabled: dashboardSettings.include_blogger_delivery
    }
  ].filter((line) => line.enabled)

  const managementPlusTotal = managementPlusLines.reduce((sum, line) => sum + line.amount, 0)
  const managementMinusTotal = managementMinusLines.reduce((sum, line) => sum + line.amount, 0)
  const managementResult = managementPlusTotal - managementMinusTotal

  const workbook = XLSX.utils.book_new()

  const summarySheet = XLSX.utils.json_to_sheet([
    { Показатель: 'Период', Значение: isAllTime ? 'За все время' : `${from} — ${to}` },
    { Показатель: 'Управленческие плюсы', Значение: toRub(managementPlusTotal) },
    { Показатель: 'Управленческие минусы', Значение: toRub(managementMinusTotal) },
    { Показатель: 'Управленческий итог', Значение: toRub(managementResult) },
    { Показатель: 'Финансы: доходы', Значение: toRub(incomeTotal) },
    { Показатель: 'Финансы: расходы', Значение: toRub(expenseTotal) },
    {
      Показатель: 'Продажи: нетто',
      Значение: toRub(salesRows.reduce((sum, row) => sum + row.net_revenue_signed, 0))
    },
    {
      Показатель: 'Продажи: скидки',
      Значение: toRub(salesRows.reduce((sum, row) => sum + row.discount_signed, 0))
    },
    {
      Показатель: 'Продажи: себестоимость',
      Значение: toRub(salesRows.reduce((sum, row) => sum + row.cost_signed, 0))
    },
    {
      Показатель: 'Продажи: доставка',
      Значение: toRub(salesRows.reduce((sum, row) => sum + row.delivery_signed, 0))
    }
  ])
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка')

  const incomeSheet = XLSX.utils.json_to_sheet(
    incomeRows.map((row) => ({
      Дата: toRuDateTime(row.occurred_at),
      Сумма: toRub(row.amount),
      Категория: row.category?.name ?? 'Без категории',
      Источник: row.payment_source?.name ?? '—',
      Комментарий: row.note ?? ''
    }))
  )
  XLSX.utils.book_append_sheet(workbook, incomeSheet, 'Доходы')

  const expenseSheet = XLSX.utils.json_to_sheet(
    expenseRows.map((row) => ({
      Дата: toRuDateTime(row.occurred_at),
      Сумма: toRub(row.amount),
      Категория: row.category?.name ?? 'Без категории',
      Источник: row.payment_source?.name ?? '—',
      Комментарий: row.note ?? ''
    }))
  )
  XLSX.utils.book_append_sheet(workbook, expenseSheet, 'Расходы')

  const salesSheet = XLSX.utils.json_to_sheet(
    salesRows.map((row) => ({
      Дата: toRuDateTime(row.occurred_at),
      Тип: operationTypeLabel(row.type),
      Город: row.city ?? '—',
      Промокод: row.promo_code ?? '—',
      Ед: row.qty,
      Выручка_брутто: toRub(row.gross_revenue),
      Скидка: toRub(row.discount_value),
      Выручка_нетто: toRub(row.net_revenue),
      Себестоимость: toRub(row.cost_value),
      Доставка: toRub(row.delivery_value)
    }))
  )
  XLSX.utils.book_append_sheet(workbook, salesSheet, 'Продажи')

  const bloggerSheet = XLSX.utils.json_to_sheet(
    bloggerRows.map((row) => ({
      Дата: toRuDateTime(row.occurred_at),
      Тип: operationTypeLabel(row.type),
      Ед: row.qty,
      Себестоимость: toRub(row.cost),
      Доставка: toRub(row.delivery)
    }))
  )
  XLSX.utils.book_append_sheet(workbook, bloggerSheet, 'Блогеры')

  const plusSheet = XLSX.utils.json_to_sheet(
    managementPlusLines.map((line) => ({
      Компонент: line.component,
      Сумма: toRub(line.amount)
    }))
  )
  XLSX.utils.book_append_sheet(workbook, plusSheet, 'Плюсы')

  const minusSheet = XLSX.utils.json_to_sheet(
    managementMinusLines.map((line) => ({
      Компонент: line.component,
      Сумма: toRub(line.amount)
    }))
  )
  XLSX.utils.book_append_sheet(workbook, minusSheet, 'Минусы')

  const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  const suffix = isAllTime ? 'all-time' : `${from}_${to}`
  const filename = `dashboard-report_${suffix}.xlsx`

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    }
  })
}