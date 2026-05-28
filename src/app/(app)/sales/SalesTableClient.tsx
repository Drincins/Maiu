'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { formatMoney } from '@/lib/money'
import {
  SALES_ORDER_SOURCE_LABELS,
  SALES_ORDER_STATUSES,
  getSalesStatusLabel,
  getSalesStatusTone,
  isSalesOrderStatus,
  type SalesOrderSource,
  type SalesOrderStatus
} from '@/lib/sales'
import {
  createSalesReturn,
  updateSalesOrderChzStatus,
  updateSalesOrderStatus
} from './actions'

type SalesOrderItemRow = {
  variant_id: string | null
  qty: number
  product_name_snapshot: string | null
  sku_snapshot: string | null
  unit_price_snapshot: number | null
  unit_cost_snapshot: number | null
}

type SalesOrderRow = {
  id: string
  source: string
  source_external_id: string | null
  status: string
  chz_submitted: boolean
  status_changed_at: string
  ordered_at: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  city: string | null
  delivery_service: string | null
  tracking_number: string | null
  delivery_cost: number | null
  total_amount: number | null
  paid_amount: number | null
  note: string | null
  sales_order_items?: SalesOrderItemRow[] | null
}

type SalesTableClientProps = {
  orders: SalesOrderRow[]
}

const sourceLabel = (source: string) =>
  SALES_ORDER_SOURCE_LABELS[source as SalesOrderSource] ?? source

const statusLabel = (status: string) =>
  isSalesOrderStatus(status) ? getSalesStatusLabel(status) : status

const statusTone = (status: string) =>
  isSalesOrderStatus(status) ? getSalesStatusTone(status) : 'neutral'

const closedReturnStatuses = new Set(['returned_to_stock', 'refunded', 'cancelled'])

export default function SalesTableClient({ orders }: SalesTableClientProps) {
  const [rows, setRows] = useState(orders)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

    return rows.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false
      if (sourceFilter && order.source !== sourceFilter) return false

      const orderedTs = new Date(order.ordered_at).getTime()
      if (fromTs !== null && orderedTs < fromTs) return false
      if (toTs !== null && orderedTs > toTs) return false

      if (!query) return true

      const products = (order.sales_order_items ?? [])
        .map((item) => `${item.product_name_snapshot ?? ''} ${item.sku_snapshot ?? ''}`)
        .join(' ')
      const haystack = [
        order.id,
        order.source_external_id ?? '',
        statusLabel(order.status),
        sourceLabel(order.source),
        order.chz_submitted ? 'чз да внесен' : 'чз нет не внесен',
        order.customer_name ?? '',
        order.customer_phone ?? '',
        order.customer_email ?? '',
        order.city ?? '',
        order.delivery_service ?? '',
        order.tracking_number ?? '',
        order.note ?? '',
        products
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [rows, searchQuery, statusFilter, sourceFilter, dateFrom, dateTo])

  const exportHref = useMemo(() => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    if (statusFilter) params.set('status', statusFilter)
    if (sourceFilter) params.set('source', sourceFilter)
    const query = params.toString()
    return query ? `/sales/export?${query}` : '/sales/export'
  }, [dateFrom, dateTo, statusFilter, sourceFilter])

  const updateStatus = (orderId: string, status: SalesOrderStatus) => {
    setPendingId(orderId)
    setActionError(null)

    startTransition(async () => {
      const result = await updateSalesOrderStatus(orderId, status)
      if (result?.error) {
        setActionError(result.error)
        setPendingId(null)
        return
      }

      setRows((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                status_changed_at: new Date().toISOString()
              }
            : order
        )
      )
      setPendingId(null)
    })
  }

  const updateChzStatus = (orderId: string, chzSubmitted: boolean) => {
    setPendingId(orderId)
    setActionError(null)

    startTransition(async () => {
      const result = await updateSalesOrderChzStatus(orderId, chzSubmitted)
      if (!result?.ok) {
        setActionError(result?.error ?? 'Не удалось обновить ЧЗ')
        setPendingId(null)
        return
      }

      setRows((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                chz_submitted: result.chzSubmitted
              }
            : order
        )
      )
      setPendingId(null)
    })
  }

  const createReturn = (orderId: string) => {
    const confirmed = window.confirm(
      'Оформить возврат по всей продаже? Будет создана складская операция возврата.'
    )
    if (!confirmed) return

    setPendingId(orderId)
    setActionError(null)

    startTransition(async () => {
      const result = await createSalesReturn(orderId)
      if (!result?.ok) {
        setActionError(result?.error ?? 'Не удалось оформить возврат')
        setPendingId(null)
        return
      }

      setRows((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: result.status,
                status_changed_at: result.changedAt
              }
            : order
        )
      )
      setPendingId(null)
    })
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
    setSourceFilter('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Поиск: клиент, трек, товар"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">Все статусы</option>
          {SALES_ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {getSalesStatusLabel(status)}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
        >
          <option value="">Все источники</option>
          <option value="operation">Операции</option>
          <option value="manual">Вручную</option>
          <option value="tilda">Tilda</option>
        </select>
        <input
          type="date"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <input
          type="date"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="px-3" onClick={clearFilters}>
            Сброс
          </Button>
          <Link href={exportHref} className="inline-flex">
            <Button type="button" className="px-3">
              Excel
            </Button>
          </Link>
        </div>
      </div>

      <div className="text-xs text-slate-500">Найдено продаж: {filteredRows.length}</div>

      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
          Ошибка: {actionError}
        </div>
      ) : null}

      <Table>
        <THead>
          <TR>
            <TH>Дата</TH>
            <TH>Статус</TH>
            <TH>Внесен в ЧЗ</TH>
            <TH>Источник</TH>
            <TH>Клиент</TH>
            <TH>Состав</TH>
            <TH>Доставка</TH>
            <TH>Комментарий</TH>
            <TH>Сумма</TH>
            <TH>Действия</TH>
          </TR>
        </THead>
        <TBody>
          {filteredRows.length ? (
            filteredRows.map((order) => {
              const items = order.sales_order_items ?? []
              const itemLabel = items.length
                ? items
                    .slice(0, 2)
                    .map(
                      (item) =>
                        `${item.product_name_snapshot ?? item.sku_snapshot ?? 'Товар'} × ${item.qty}`
                    )
                    .join(', ')
                : '—'
              const extraItems = items.length > 2 ? ` +${items.length - 2}` : ''
              const customer =
                order.customer_name ||
                order.customer_phone ||
                order.customer_email ||
                order.city ||
                '—'
              const canCreateReturn =
                !closedReturnStatuses.has(order.status) &&
                Boolean(order.sales_order_items?.length)

              return (
                <TR key={order.id}>
                  <TD>{new Date(order.ordered_at).toLocaleString('ru-RU')}</TD>
                  <TD>
                    <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
                  </TD>
                  <TD>
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={order.chz_submitted ? 'yes' : 'no'}
                      disabled={isPending && pendingId === order.id}
                      onChange={(event) =>
                        updateChzStatus(order.id, event.target.value === 'yes')
                      }
                    >
                      <option value="no">Нет</option>
                      <option value="yes">Да</option>
                    </select>
                  </TD>
                  <TD>{sourceLabel(order.source)}</TD>
                  <TD>
                    <div className="font-medium text-slate-900">{customer}</div>
                    {order.city ? (
                      <div className="text-xs text-slate-500">{order.city}</div>
                    ) : null}
                  </TD>
                  <TD>
                    {itemLabel}
                    {extraItems}
                  </TD>
                  <TD>
                    <div>{order.delivery_service ?? '—'}</div>
                    {order.tracking_number ? (
                      <div className="text-xs text-slate-500">{order.tracking_number}</div>
                    ) : null}
                  </TD>
                  <TD className="max-w-[220px] truncate">{order.note ?? '—'}</TD>
                  <TD>{formatMoney(order.total_amount ?? 0)}</TD>
                  <TD>
                    <div className="flex min-w-[190px] flex-col gap-2">
                      <select
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={isSalesOrderStatus(order.status) ? order.status : 'problem'}
                        disabled={isPending && pendingId === order.id}
                        onChange={(event) =>
                          updateStatus(order.id, event.target.value as SalesOrderStatus)
                        }
                      >
                        {SALES_ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {getSalesStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                      {canCreateReturn ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-3 py-2 text-[10px]"
                          disabled={isPending && pendingId === order.id}
                          onClick={() => createReturn(order.id)}
                        >
                          Оформить возврат
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              )
            })
          ) : (
            <TR>
              <TD colSpan={10} className="text-center text-slate-500">
                Продажи не найдены
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
    </div>
  )
}
