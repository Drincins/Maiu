'use client'

import { useMemo, useState } from 'react'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { Badge } from '@/components/Badge'
import { formatMoney } from '@/lib/money'
import OperationRowActions from './OperationRowActions'

type OperationRow = {
  id: string
  type: string
  occurred_at: string
  city: string | null
  delivery_cost: number | null
  note: string | null
  from_location_id: string | null
  to_location_id: string | null
  promo_code_id: string | null
}

type LocationRow = {
  id: string
  name: string
}

type OperationsTableClientProps = {
  operations: OperationRow[]
  locations: LocationRow[]
  issueOperationIds: string[]
}

type SortKey =
  | 'occurred_desc'
  | 'occurred_asc'
  | 'delivery_desc'
  | 'delivery_asc'
  | 'type_asc'
  | 'type_desc'
  | 'city_asc'
  | 'city_desc'

type QuickFilter =
  | 'all'
  | 'with_promo'
  | 'without_promo'
  | 'with_delivery'
  | 'without_delivery'

const typeLabels: Record<string, string> = {
  inbound: 'Приход',
  transfer: 'Перемещение',
  ship_blogger: 'Отправка блогеру',
  return_blogger: 'Возврат от блогера',
  sale: 'Продажа',
  sale_return: 'Возврат продажи',
  writeoff: 'Списание',
  adjustment: 'Корректировка'
}

export default function OperationsTableClient({
  operations,
  locations,
  issueOperationIds
}: OperationsTableClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('occurred_desc')

  const locationMap = useMemo(
    () => new Map(locations.map((item) => [item.id, item.name])),
    [locations]
  )
  const issueSet = useMemo(() => new Set(issueOperationIds), [issueOperationIds])

  const typeOptions = useMemo(() => {
    const unique = Array.from(new Set(operations.map((operation) => operation.type)))
    return unique.sort((a, b) =>
      (typeLabels[a] ?? a).localeCompare(typeLabels[b] ?? b, 'ru')
    )
  }, [operations])

  const filteredOperations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

    const filtered = operations.filter((operation) => {
      if (typeFilter && operation.type !== typeFilter) return false

      const hasPromo = Boolean(operation.promo_code_id)
      const hasDelivery = (operation.delivery_cost ?? 0) > 0
      if (quickFilter === 'with_promo' && !hasPromo) return false
      if (quickFilter === 'without_promo' && hasPromo) return false
      if (quickFilter === 'with_delivery' && !hasDelivery) return false
      if (quickFilter === 'without_delivery' && hasDelivery) return false

      const operationTs = new Date(operation.occurred_at).getTime()
      if (fromTs !== null && operationTs < fromTs) return false
      if (toTs !== null && operationTs > toTs) return false

      if (!query) return true

      const fromName = operation.from_location_id
        ? locationMap.get(operation.from_location_id) ?? ''
        : ''
      const toName = operation.to_location_id
        ? locationMap.get(operation.to_location_id) ?? ''
        : ''

      const haystack = [
        operation.id,
        typeLabels[operation.type] ?? operation.type,
        operation.city ?? '',
        operation.note ?? '',
        fromName,
        toName
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.occurred_at).getTime()
      const dateB = new Date(b.occurred_at).getTime()
      const deliveryA = a.delivery_cost ?? 0
      const deliveryB = b.delivery_cost ?? 0
      const typeA = typeLabels[a.type] ?? a.type
      const typeB = typeLabels[b.type] ?? b.type
      const cityA = a.city ?? ''
      const cityB = b.city ?? ''

      switch (sortBy) {
        case 'occurred_asc':
          return dateA - dateB
        case 'delivery_desc':
          return deliveryB - deliveryA
        case 'delivery_asc':
          return deliveryA - deliveryB
        case 'type_asc':
          return typeA.localeCompare(typeB, 'ru')
        case 'type_desc':
          return typeB.localeCompare(typeA, 'ru')
        case 'city_asc':
          return cityA.localeCompare(cityB, 'ru')
        case 'city_desc':
          return cityB.localeCompare(cityA, 'ru')
        case 'occurred_desc':
        default:
          return dateB - dateA
      }
    })
  }, [
    operations,
    searchQuery,
    typeFilter,
    quickFilter,
    dateFrom,
    dateTo,
    sortBy,
    issueSet,
    locationMap
  ])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <input
          className="rounded-xl border border-slate-200 px-3 py-2"
          placeholder="Поиск: ID, тип, город, комментарий, локация"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="">Все типы</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {typeLabels[type] ?? type}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={quickFilter}
          onChange={(event) => setQuickFilter(event.target.value as QuickFilter)}
        >
          <option value="all">Все</option>
          <option value="with_promo">С промокодом</option>
          <option value="without_promo">Без промокода</option>
          <option value="with_delivery">С доставкой</option>
          <option value="without_delivery">Без доставки</option>
        </select>
        <input
          type="date"
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <input
          type="date"
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortKey)}
        >
          <option value="occurred_desc">Дата: новые сверху</option>
          <option value="occurred_asc">Дата: старые сверху</option>
          <option value="delivery_desc">Доставка: по убыванию</option>
          <option value="delivery_asc">Доставка: по возрастанию</option>
          <option value="type_asc">Тип: А-Я</option>
          <option value="type_desc">Тип: Я-А</option>
          <option value="city_asc">Город: А-Я</option>
          <option value="city_desc">Город: Я-А</option>
        </select>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Дата</TH>
            <TH>Тип</TH>
            <TH>Город</TH>
            <TH>Доставка</TH>
            <TH>Откуда &rarr; Куда</TH>
            <TH>Проблемы</TH>
            <TH>Комментарий</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {filteredOperations.length ? (
            filteredOperations.map((operation) => {
              const fromName = operation.from_location_id
                ? locationMap.get(operation.from_location_id) ?? '—'
                : '—'
              const toName = operation.to_location_id
                ? locationMap.get(operation.to_location_id) ?? '—'
                : '—'

              return (
                <TR key={operation.id}>
                  <TD>{new Date(operation.occurred_at).toLocaleString('ru-RU')}</TD>
                  <TD>
                    <Badge tone="info">{typeLabels[operation.type] ?? operation.type}</Badge>
                  </TD>
                  <TD>{operation.city ?? '—'}</TD>
                  <TD>{operation.delivery_cost ? formatMoney(operation.delivery_cost) : '—'}</TD>
                  <TD>
                    {fromName} &rarr; {toName}
                  </TD>
                  <TD>
                    {issueSet.has(operation.id) ? <Badge tone="warning">Маркировка</Badge> : '—'}
                  </TD>
                  <TD className="max-w-[240px] truncate">{operation.note ?? '—'}</TD>
                  <TD>
                    <OperationRowActions operationId={operation.id} />
                  </TD>
                </TR>
              )
            })
          ) : (
            <TR>
              <TD colSpan={8} className="text-center text-slate-500">
                Ничего не найдено по выбранным параметрам
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
    </div>
  )
}
