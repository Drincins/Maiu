'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { Badge } from '@/components/Badge'
import { formatMoney } from '@/lib/money'
import OperationRowActions from './OperationRowActions'

type ProductModel = {
  name: string | null
}

type ProductVariant = {
  sku: string | null
  size: string | null
  color: string | null
  product_models?: ProductModel | ProductModel[] | null
}

type OperationLine = {
  qty: number
  unit_price_snapshot: number | null
  unit_cost_snapshot: number | null
  product_variants?: ProductVariant | ProductVariant[] | null
}

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
  operation_lines?: OperationLine[]
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

type SortField = 'occurred_at' | 'type' | 'city' | 'delivery_cost'
type SortDirection = 'asc' | 'desc'

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

const quickFilterLabels: Record<QuickFilter, string> = {
  all: 'Все',
  with_promo: 'С промокодом',
  without_promo: 'Без промокода',
  with_delivery: 'С доставкой',
  without_delivery: 'Без доставки'
}

const sortFieldLabels: Record<SortField, string> = {
  occurred_at: 'Дата',
  type: 'Тип',
  city: 'Город',
  delivery_cost: 'Доставка'
}

const sortDirectionLabels: Record<SortDirection, string> = {
  asc: 'по возрастанию',
  desc: 'по убыванию'
}

const BRAND_HEADER = 'FF74121D'
const BRAND_BORDER = 'FFD7B1B7'
const RUB_NUMFMT = '#,##0.00 [$₽-419]'

const toRub = (kopecks: number | null | undefined) => (kopecks ?? 0) / 100

const normalizeVariant = (value: ProductVariant | ProductVariant[] | null | undefined) => {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

const normalizeModel = (value: ProductModel | ProductModel[] | null | undefined) => {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

const ExcelIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 2v6h6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 11.5l4 5M13 11.5l-4 5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

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
  const [sortField, setSortField] = useState<SortField>('occurred_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const filtersPopupRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isFiltersOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (!filtersPopupRef.current) return
      if (!filtersPopupRef.current.contains(event.target as Node)) {
        setIsFiltersOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFiltersOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isFiltersOpen])

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

  const activeFiltersCount =
    Number(Boolean(searchQuery.trim())) +
    Number(Boolean(typeFilter)) +
    Number(quickFilter !== 'all') +
    Number(Boolean(dateFrom)) +
    Number(Boolean(dateTo))

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
      const factor = sortDirection === 'asc' ? 1 : -1
      const dateA = new Date(a.occurred_at).getTime()
      const dateB = new Date(b.occurred_at).getTime()

      if (sortField === 'occurred_at') {
        return (dateA - dateB) * factor
      }

      if (sortField === 'delivery_cost') {
        return ((a.delivery_cost ?? 0) - (b.delivery_cost ?? 0)) * factor
      }

      if (sortField === 'type') {
        return ((typeLabels[a.type] ?? a.type).localeCompare(typeLabels[b.type] ?? b.type, 'ru')) * factor
      }

      return ((a.city ?? '').localeCompare(b.city ?? '', 'ru')) * factor
    })
  }, [
    operations,
    searchQuery,
    typeFilter,
    quickFilter,
    dateFrom,
    dateTo,
    sortField,
    sortDirection,
    locationMap
  ])

  const onSortBy = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(field)
    setSortDirection(field === 'occurred_at' || field === 'delivery_cost' ? 'desc' : 'asc')
  }

  const clearFilters = () => {
    setSearchQuery('')
    setTypeFilter('')
    setQuickFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const sortLabel = `${sortFieldLabels[sortField]} (${sortDirectionLabels[sortDirection]})`

  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)

    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Maiu'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('Операции', {
        views: [{ state: 'frozen', ySplit: 1 }]
      })

      worksheet.columns = [
        { header: '№', key: 'index', width: 6 },
        { header: 'Дата', key: 'occurredAt', width: 22 },
        { header: 'Тип', key: 'type', width: 18 },
        { header: 'Город', key: 'city', width: 18 },
        { header: 'Промокод', key: 'promoCode', width: 24 },
        { header: 'Откуда', key: 'fromName', width: 20 },
        { header: 'Куда', key: 'toName', width: 20 },
        { header: 'Товар', key: 'productName', width: 28 },
        { header: 'SKU', key: 'sku', width: 16 },
        { header: 'Размер', key: 'size', width: 12 },
        { header: 'Цвет', key: 'color', width: 16 },
        { header: 'Кол-во', key: 'qty', width: 10 },
        { header: 'Цена', key: 'unitPrice', width: 14 },
        { header: 'Себестоимость', key: 'unitCost', width: 16 },
        { header: 'Сумма продажи', key: 'lineRevenue', width: 16 },
        { header: 'Сумма себестоимости', key: 'lineCost', width: 18 },
        { header: 'Доставка', key: 'delivery', width: 14 },
        { header: 'Маркировка', key: 'marking', width: 14 },
        { header: 'Комментарий', key: 'comment', width: 26 }
      ]

      type ExportRow = {
        occurredAt: string
        type: string
        city: string
        promoCode: string
        fromName: string
        toName: string
        productName: string
        sku: string
        size: string
        color: string
        qty: number
        unitPrice: number
        unitCost: number
        lineRevenue: number
        lineCost: number
        delivery: number | null
        marking: string
        comment: string
      }

      const exportRows: ExportRow[] = filteredOperations.flatMap((operation) => {
        const fromName = operation.from_location_id
          ? locationMap.get(operation.from_location_id) ?? '—'
          : '—'
        const toName = operation.to_location_id
          ? locationMap.get(operation.to_location_id) ?? '—'
          : '—'
        const hasIssue = issueSet.has(operation.id)
        const lines = operation.operation_lines?.length ? operation.operation_lines : [null]

        return lines.map((line, lineIndex) => {
          const variant = normalizeVariant(line?.product_variants)
          const model = normalizeModel(variant?.product_models)
          const qty = line?.qty ?? 0
          const unitPrice = toRub(line?.unit_price_snapshot)
          const unitCost = toRub(line?.unit_cost_snapshot)

          return {
            occurredAt: new Date(operation.occurred_at).toLocaleString('ru-RU'),
            type: typeLabels[operation.type] ?? operation.type,
            city: operation.city ?? '—',
            promoCode: operation.promo_code_id ?? '—',
            fromName,
            toName,
            productName: model?.name ?? '—',
            sku: variant?.sku ?? '—',
            size: variant?.size ?? '—',
            color: variant?.color ?? '—',
            qty,
            unitPrice,
            unitCost,
            lineRevenue: qty * unitPrice,
            lineCost: qty * unitCost,
            delivery: lineIndex === 0 ? toRub(operation.delivery_cost) : null,
            marking: hasIssue ? 'Проблема' : 'OK',
            comment: operation.note ?? ''
          }
        })
      })

      if (!exportRows.length) {
        const row = worksheet.addRow({
          comment: 'По выбранным фильтрам операций не найдено'
        })
        row.getCell('A').value = 1
      } else {
        exportRows.forEach((rowData, index) => {
          worksheet.addRow({
            index: index + 1,
            ...rowData
          })
        })
      }

      const totals = exportRows.reduce(
        (acc, row) => ({
          qty: acc.qty + row.qty,
          lineRevenue: acc.lineRevenue + row.lineRevenue,
          lineCost: acc.lineCost + row.lineCost,
          delivery: acc.delivery + (row.delivery ?? 0)
        }),
        { qty: 0, lineRevenue: 0, lineCost: 0, delivery: 0 }
      )
      const finalResult = totals.lineRevenue - totals.lineCost - totals.delivery

      const totalsRow = worksheet.addRow({
        productName: 'ИТОГО',
        qty: totals.qty,
        lineRevenue: totals.lineRevenue,
        lineCost: totals.lineCost,
        delivery: totals.delivery,
        comment: `Финальный итог: ${new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: 'RUB'
        }).format(finalResult)}`
      })

      const headerRow = worksheet.getRow(1)
      headerRow.height = 28
      headerRow.eachCell((cell) => {
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' }
        }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: BRAND_HEADER }
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        }
        cell.border = {
          top: { style: 'thin', color: { argb: BRAND_BORDER } },
          right: { style: 'thin', color: { argb: BRAND_BORDER } },
          bottom: { style: 'thin', color: { argb: BRAND_BORDER } },
          left: { style: 'thin', color: { argb: BRAND_BORDER } }
        }
      })

      worksheet.autoFilter = {
        from: 'A1',
        to: 'S1'
      }

      const currencyCols = ['M', 'N', 'O', 'P', 'Q']
      const numberCols = ['L']

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber)
        row.height = 24

        row.eachCell((cell) => {
          cell.alignment = {
            vertical: 'top',
            wrapText: true
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE6E6E6' } },
            right: { style: 'thin', color: { argb: 'FFE6E6E6' } },
            bottom: { style: 'thin', color: { argb: 'FFE6E6E6' } },
            left: { style: 'thin', color: { argb: 'FFE6E6E6' } }
          }
        })

        currencyCols.forEach((column) => {
          const cell = row.getCell(column)
          if (typeof cell.value === 'number') {
            cell.numFmt = RUB_NUMFMT
          }
        })

        numberCols.forEach((column) => {
          const cell = row.getCell(column)
          if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0'
          }
        })
      }

      totalsRow.font = {
        bold: true
      }
      totalsRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9EEF0' }
        }
      })

      const summary = workbook.addWorksheet('Сводка')
      summary.columns = [
        { header: 'Показатель', key: 'name', width: 42 },
        { header: 'Значение', key: 'value', width: 24 }
      ]

      const summaryRows = [
        { name: 'Сформировано', value: new Date().toLocaleString('ru-RU') },
        { name: 'Строк в отчете', value: exportRows.length },
        { name: 'Операций', value: filteredOperations.length },
        { name: 'Поиск', value: searchQuery.trim() || '—' },
        { name: 'Тип операции', value: typeFilter ? (typeLabels[typeFilter] ?? typeFilter) : 'Все' },
        { name: 'Быстрый фильтр', value: quickFilterLabels[quickFilter] },
        { name: 'Дата с', value: dateFrom || '—' },
        { name: 'Дата по', value: dateTo || '—' },
        { name: 'Сортировка', value: sortLabel },
        { name: 'Итоговая выручка', value: totals.lineRevenue },
        { name: 'Итоговая себестоимость', value: totals.lineCost },
        { name: 'Итоговая доставка', value: totals.delivery },
        { name: 'Финальный итог', value: finalResult }
      ]
      summaryRows.forEach((item) => summary.addRow(item))

      const summaryHeader = summary.getRow(1)
      summaryHeader.height = 26
      summaryHeader.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: BRAND_HEADER }
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      })

      for (let rowNumber = 2; rowNumber <= summary.rowCount; rowNumber += 1) {
        const row = summary.getRow(rowNumber)
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'top', wrapText: true }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE6E6E6' } },
            right: { style: 'thin', color: { argb: 'FFE6E6E6' } },
            bottom: { style: 'thin', color: { argb: 'FFE6E6E6' } },
            left: { style: 'thin', color: { argb: 'FFE6E6E6' } }
          }
        })
      }

      ;[10, 11, 12, 13].forEach((summaryRowNumber) => {
        const cell = summary.getRow(summaryRowNumber).getCell('B')
        if (typeof cell.value === 'number') {
          cell.numFmt = RUB_NUMFMT
          cell.font = { bold: true }
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const dateSuffix = new Date().toISOString().slice(0, 10)

      link.href = downloadUrl
      link.download = `operations_${quickFilter}_${typeFilter || 'all'}_${dateSuffix}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Не удалось сформировать отчет')
    } finally {
      setIsExporting(false)
    }
  }

  const renderSortableHeader = (label: string, field: SortField) => {
    const isActive = sortField === field
    const arrow = !isActive ? '↕' : sortDirection === 'asc' ? '↑' : '↓'

    return (
      <button
        type="button"
        className={`inline-flex items-center gap-1 ${
          isActive ? 'text-brand-700' : 'text-slate-500'
        }`}
        onClick={() => onSortBy(field)}
      >
        <span>{label}</span>
        <span className="text-[11px]">{arrow}</span>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative flex flex-wrap items-center justify-between gap-3" ref={filtersPopupRef}>
        <div className="text-xs text-slate-500">Найдено операций: {filteredOperations.length}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleExport}
            disabled={isExporting}
            title={isExporting ? 'Формируем Excel...' : 'Скачать Excel'}
            aria-label="Скачать Excel"
          >
            <ExcelIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-100"
            onClick={() => setIsFiltersOpen((prev) => !prev)}
          >
            Фильтры
            {activeFiltersCount ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] text-white">
                {activeFiltersCount}
              </span>
            ) : null}
          </button>
        </div>

        {isFiltersOpen ? (
          <div className="absolute right-0 top-full z-20 mt-2 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Поиск
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal"
                  placeholder="ID, тип, город, комментарий, локация"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Тип операции
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal"
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
              </label>

              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Быстрый фильтр
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal"
                  value={quickFilter}
                  onChange={(event) => setQuickFilter(event.target.value as QuickFilter)}
                >
                  <option value="all">Все</option>
                  <option value="with_promo">С промокодом</option>
                  <option value="without_promo">Без промокода</option>
                  <option value="with_delivery">С доставкой</option>
                  <option value="without_delivery">Без доставки</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Дата с
                <input
                  type="date"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Дата по
                <input
                  type="date"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>

              <div className="flex items-end justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-100"
                  onClick={clearFilters}
                >
                  Сбросить
                </button>
                <button
                  type="button"
                  className="rounded-full bg-brand-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-brand-800"
                  onClick={() => setIsFiltersOpen(false)}
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {exportError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
          Ошибка экспорта: {exportError}
        </div>
      ) : null}

      <Table>
        <THead>
          <TR>
            <TH>{renderSortableHeader('Дата', 'occurred_at')}</TH>
            <TH>{renderSortableHeader('Тип', 'type')}</TH>
            <TH>{renderSortableHeader('Город', 'city')}</TH>
            <TH>{renderSortableHeader('Доставка', 'delivery_cost')}</TH>
            <TH>Откуда → Куда</TH>
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
                    {fromName} → {toName}
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