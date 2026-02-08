import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'

type DashboardPageProps = {
  searchParams?:
    | Promise<{ from?: string; to?: string; report?: string }>
    | { from?: string; to?: string; report?: string }
}

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
  discount_value_snapshot?: number | null
  city?: string | null
  operation_lines?: OperationLine[]
  counterparty?: { name: string | null } | null
}

type FinanceRow = {
  id: string
  occurred_at: string
  type: 'income' | 'expense'
  amount: number
  category?: { name: string | null } | null
  payment_source?: { name: string | null } | null
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams
  const from = resolvedSearchParams?.from
  const to = resolvedSearchParams?.to
  const reportParam = resolvedSearchParams?.report
  const reportType = reportParam === 'sales' || reportParam === 'blogger' || reportParam === 'finance'
    ? reportParam
    : ''

  const fromISO = from ? new Date(`${from}T00:00:00`).toISOString() : null
  const toISO = to ? new Date(`${to}T23:59:59.999`).toISOString() : null

  const applyDateFilter = (query: any) => {
    let next = query
    if (fromISO) next = next.gte('occurred_at', fromISO)
    if (toISO) next = next.lte('occurred_at', toISO)
    return next
  }

  const [{ data: salesOps }, { data: bloggerOps }, { data: finance }] = await Promise.all([
    applyDateFilter(
      supabase
        .from('operations')
        .select(
          'id, occurred_at, type, city, delivery_cost, promo_code_snapshot, discount_value_snapshot, operation_lines(qty, unit_price_snapshot, unit_cost_snapshot)'
        )
        .in('type', ['sale', 'sale_return'])
    ),
    applyDateFilter(
      supabase
        .from('operations')
        .select(
          'id, occurred_at, type, delivery_cost, counterparty:counterparty_id(name), operation_lines(qty, unit_cost_snapshot)'
        )
        .in('type', ['ship_blogger', 'return_blogger'])
    ),
    applyDateFilter(
      supabase
        .from('finance_transactions')
        .select('id, occurred_at, type, amount, category:category_id(name), payment_source:payment_source_id(name)')
    )
  ])

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString('ru-RU') : '—'

  const salesRows = (salesOps as OperationRow[] | null | undefined)?.map((op) => {
    const sign = op.type === 'sale_return' ? -1 : 1
    const lines = op.operation_lines ?? []
    const qty = lines.reduce((sum, line) => sum + (line.qty ?? 0), 0)
    const revenue = lines.reduce(
      (sum, line) => sum + (line.unit_price_snapshot ?? 0) * line.qty,
      0
    )
    const cost = lines.reduce(
      (sum, line) => sum + (line.unit_cost_snapshot ?? 0) * line.qty,
      0
    )
    const discount = op.discount_value_snapshot ?? 0
    const netRevenue = Math.max(0, revenue - discount)
    return {
      id: op.id,
      occurred_at: op.occurred_at,
      type: op.type ?? 'sale',
      city: op.city ?? null,
      qty: qty * sign,
      revenue: netRevenue * sign,
      discount: discount * sign,
      cost: cost * sign,
      delivery_cost: (op.delivery_cost ?? 0) * sign,
      profit: netRevenue * sign + (op.delivery_cost ?? 0) * sign - cost * sign,
      promo_code: op.promo_code_snapshot ?? null
    }
  }) ?? []

  const salesRevenue = salesRows.reduce((sum, row) => sum + row.revenue, 0)
  const salesCost = salesRows.reduce((sum, row) => sum + row.cost, 0)
  const salesDelivery = salesRows.reduce((sum, row) => sum + row.delivery_cost, 0)
  const salesDiscountTotal = salesRows.reduce((sum, row) => sum + row.discount, 0)
  const salesProfit = salesRevenue + salesDelivery - salesCost
  const promoOrders = salesRows.filter((row) => row.promo_code).length
  const promoDiscount = salesRows.reduce(
    (sum, row) => sum + (row.promo_code ? row.discount : 0),
    0
  )
  const deliveriesByCity = salesRows
    .filter((row) => row.type === 'sale' && row.city)
    .reduce((acc: Map<string, number>, row) => {
      const name = row.city?.trim()
      if (!name) return acc
      acc.set(name, (acc.get(name) ?? 0) + 1)
      return acc
    }, new Map<string, number>())
  const deliveryCityRows = Array.from(deliveriesByCity.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
  const salesReturnRows = salesRows.filter((row) => row.type === 'sale_return')
  const salesReturnCount = salesReturnRows.length
  const salesReturnQty = salesReturnRows.reduce((sum, row) => sum + Math.abs(row.qty), 0)
  const salesReturnRevenue = salesReturnRows.reduce((sum, row) => sum + row.revenue, 0)
  const salesReturnDelivery = salesReturnRows.reduce((sum, row) => sum + row.delivery_cost, 0)

  const bloggerRows = (bloggerOps as OperationRow[] | null | undefined)?.map((op) => {
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
      counterparty: op.counterparty?.name ?? '—',
      qty,
      cost,
      delivery_cost: op.delivery_cost ?? 0
    }
  }) ?? []

  const shipRows = bloggerRows.filter((row) => row.type === 'ship_blogger')
  const bloggerReturnRows = bloggerRows.filter((row) => row.type === 'return_blogger')

  const shipCount = shipRows.length
  const shipQty = shipRows.reduce((sum, row) => sum + row.qty, 0)
  const shipCost = shipRows.reduce((sum, row) => sum + row.cost, 0)
  const shipDelivery = shipRows.reduce((sum, row) => sum + row.delivery_cost, 0)

  const bloggerReturnCount = bloggerReturnRows.length
  const bloggerReturnQty = bloggerReturnRows.reduce((sum, row) => sum + row.qty, 0)

  const financeRows = (finance as FinanceRow[] | null | undefined) ?? []
  const incomeRows = financeRows.filter((row) => row.type === 'income')
  const expenseRows = financeRows.filter((row) => row.type === 'expense')
  const incomeTotal = incomeRows.reduce((sum, row) => sum + row.amount, 0)
  const expenseTotal = expenseRows.reduce((sum, row) => sum + row.amount, 0)

  const summarizeFinance = (rows: FinanceRow[], key: (row: FinanceRow) => string) => {
    const map = new Map<string, { name: string; total: number; count: number }>()
    rows.forEach((row) => {
      const name = key(row) || 'Без категории'
      const current = map.get(name) ?? { name, total: 0, count: 0 }
      map.set(name, {
        name,
        total: current.total + row.amount,
        count: current.count + 1
      })
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }

  const incomeByCategory = summarizeFinance(incomeRows, (row) => row.category?.name ?? 'Без категории')
  const expenseByCategory = summarizeFinance(expenseRows, (row) => row.category?.name ?? 'Без категории')

  const resetHref = reportType ? `/dashboard?report=${reportType}` : '/dashboard'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Дашборд</h1>
          <p className="text-sm text-slate-500">
            {from || to ? (
              <>
                Период: {from ?? '…'} — {to ?? '…'}
              </>
            ) : (
              'Сводка за все время'
            )}
          </p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          {reportType ? <input type="hidden" name="report" value={reportType} /> : null}
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            С
            <input
              type="date"
              name="from"
              defaultValue={from ?? ''}
              className="mt-1 rounded-full border border-slate-200/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700"
            />
          </label>
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            По
            <input
              type="date"
              name="to"
              defaultValue={to ?? ''}
              className="mt-1 rounded-full border border-slate-200/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700"
            />
          </label>
          <Button type="submit" variant="secondary">
            Показать
          </Button>
          <Link
            href={resetHref}
            className="rounded-full border border-slate-200/70 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-100/70"
          >
            За все время
          </Link>
        </form>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Продажи</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Продажи (с учетом скидок)
            </div>
            <div className="text-xl font-semibold text-slate-900">{formatMoney(salesRevenue)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Себестоимость</div>
            <div className="text-xl font-semibold text-slate-900">{formatMoney(salesCost)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Скидки</div>
            <div className="text-xl font-semibold text-slate-900">{formatMoney(salesDiscountTotal)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Доставка</div>
            <div className="text-xl font-semibold text-slate-900">{formatMoney(salesDelivery)}</div>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Заказы с промокодом</div>
            <div className="text-xl font-semibold text-slate-900">{promoOrders}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Скидка по промокодам
            </div>
            <div className="text-xl font-semibold text-slate-900">
              {formatMoney(promoDiscount)}
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Возвраты</div>
            <div className="text-xl font-semibold text-slate-900">{salesReturnCount}</div>
            <div className="text-[11px] text-slate-500">Единиц: {salesReturnQty}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Сумма возвратов</div>
            <div className="text-xl font-semibold text-rose-600">
              {formatMoney(salesReturnRevenue)}
            </div>
            <div className="text-[11px] text-slate-500">
              Доставка: {formatMoney(salesReturnDelivery)}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Прибыль</div>
          <div className="text-xl font-semibold text-emerald-600">{formatMoney(salesProfit)}</div>
          <div className="text-[11px] text-slate-500">
            (Продажи с учетом скидок + доставка) − себестоимость
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Передвижения по блогерам</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Отправки</div>
            <div className="text-xl font-semibold text-slate-900">{shipCount}</div>
            <div className="text-[11px] text-slate-500">Единиц: {shipQty}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Себестоимость</div>
            <div className="text-xl font-semibold text-slate-900">{formatMoney(shipCost)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Доставка</div>
            <div className="text-xl font-semibold text-slate-900">{formatMoney(shipDelivery)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Возвраты</div>
            <div className="text-xl font-semibold text-slate-900">{bloggerReturnCount}</div>
            <div className="text-[11px] text-slate-500">Единиц: {bloggerReturnQty}</div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Финансы</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Доходы</div>
            <div className="text-xl font-semibold text-emerald-600">{formatMoney(incomeTotal)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Расходы</div>
            <div className="text-xl font-semibold text-rose-600">{formatMoney(expenseTotal)}</div>
          </div>
        </div>
        <details className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Детализация по категориям
          </summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Доходы</div>
              <Table className="mt-2">
                <THead>
                  <TR>
                    <TH>Категория</TH>
                    <TH>Сумма</TH>
                    <TH>Кол-во</TH>
                  </TR>
                </THead>
                <TBody>
                  {incomeByCategory.length ? (
                    incomeByCategory.map((row) => (
                      <TR key={`income-${row.name}`}>
                        <TD>{row.name}</TD>
                        <TD className="font-semibold text-slate-900">{formatMoney(row.total)}</TD>
                        <TD>{row.count}</TD>
                      </TR>
                    ))
                  ) : (
                    <TR>
                      <TD colSpan={3}>Нет данных</TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Расходы</div>
              <Table className="mt-2">
                <THead>
                  <TR>
                    <TH>Категория</TH>
                    <TH>Сумма</TH>
                    <TH>Кол-во</TH>
                  </TR>
                </THead>
                <TBody>
                  {expenseByCategory.length ? (
                    expenseByCategory.map((row) => (
                      <TR key={`expense-${row.name}`}>
                        <TD>{row.name}</TD>
                        <TD className="font-semibold text-slate-900">{formatMoney(row.total)}</TD>
                        <TD>{row.count}</TD>
                      </TR>
                    ))
                  ) : (
                    <TR>
                      <TD colSpan={3}>Нет данных</TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
          </div>
        </details>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Доставка по городам</h2>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Город</TH>
              <TH>Кол-во доставок</TH>
            </TR>
          </THead>
          <TBody>
            {deliveryCityRows.length ? (
              deliveryCityRows.map((row) => (
                <TR key={row.city}>
                  <TD>{row.city}</TD>
                  <TD className="font-semibold text-slate-900">{row.count}</TD>
                </TR>
              ))
            ) : (
              <TR>
                <TD colSpan={2}>Нет данных</TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Конструктор отчета</h2>
            <p className="text-sm text-slate-500">
              Выберите параметры, чтобы построить нужный отчет.
            </p>
          </div>
        </div>
        <form method="get" className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          {from ? <input type="hidden" name="from" value={from} /> : null}
          {to ? <input type="hidden" name="to" value={to} /> : null}
          <Field label="Тип отчета">
            <select
              name="report"
              defaultValue={reportType}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            >
              <option value="">—</option>
              <option value="sales">Продажи</option>
              <option value="blogger">Блогеры</option>
              <option value="finance">Финансы</option>
            </select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">
              Построить
            </Button>
          </div>
        </form>

        {reportType ? (
          <div className="mt-4">
            {reportType === 'sales' ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Дата</TH>
                    <TH>Тип</TH>
                    <TH>Ед.</TH>
                    <TH>Продажи</TH>
                    <TH>Скидка</TH>
                    <TH>Себестоимость</TH>
                    <TH>Доставка</TH>
                    <TH>Прибыль</TH>
                  </TR>
                </THead>
                <TBody>
                  {salesRows.length ? (
                    salesRows.map((row) => (
                      <TR key={row.id}>
                        <TD>{formatDate(row.occurred_at)}</TD>
                        <TD>{row.type === 'sale' ? 'Продажа' : 'Возврат'}</TD>
                        <TD>{row.qty}</TD>
                        <TD>{formatMoney(row.revenue)}</TD>
                        <TD>{formatMoney(row.discount)}</TD>
                        <TD>{formatMoney(row.cost)}</TD>
                        <TD>{formatMoney(row.delivery_cost)}</TD>
                        <TD className="font-semibold text-emerald-600">
                          {formatMoney(row.profit)}
                        </TD>
                      </TR>
                    ))
                  ) : (
                    <TR>
                      <TD colSpan={8}>Нет данных</TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            ) : null}

            {reportType === 'blogger' ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Дата</TH>
                    <TH>Тип</TH>
                    <TH>Блогер</TH>
                    <TH>Ед.</TH>
                    <TH>Себестоимость</TH>
                    <TH>Доставка</TH>
                  </TR>
                </THead>
                <TBody>
                  {bloggerRows.length ? (
                    bloggerRows.map((row) => (
                      <TR key={row.id}>
                        <TD>{formatDate(row.occurred_at)}</TD>
                        <TD>{row.type === 'ship_blogger' ? 'Отправка' : 'Возврат'}</TD>
                        <TD>{row.counterparty}</TD>
                        <TD>{row.qty}</TD>
                        <TD>{formatMoney(row.cost)}</TD>
                        <TD>{formatMoney(row.delivery_cost)}</TD>
                      </TR>
                    ))
                  ) : (
                    <TR>
                      <TD colSpan={6}>Нет данных</TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            ) : null}

            {reportType === 'finance' ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Дата</TH>
                    <TH>Тип</TH>
                    <TH>Сумма</TH>
                    <TH>Категория</TH>
                    <TH>Источник</TH>
                  </TR>
                </THead>
                <TBody>
                  {financeRows.length ? (
                    financeRows.map((row) => (
                      <TR key={row.id}>
                        <TD>{formatDate(row.occurred_at)}</TD>
                        <TD>{row.type === 'income' ? 'Доход' : 'Расход'}</TD>
                        <TD className={row.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatMoney(row.amount)}
                        </TD>
                        <TD>{row.category?.name ?? 'Без категории'}</TD>
                        <TD>{row.payment_source?.name ?? '—'}</TD>
                      </TR>
                    ))
                  ) : (
                    <TR>
                      <TD colSpan={5}>Нет данных</TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-500">
            Выберите тип отчета и нажмите «Построить».
          </div>
        )}
      </Card>
    </div>
  )
}
