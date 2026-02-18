'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { formatMoney } from '@/lib/money'
import { archiveModel } from './actions'

type Variant = {
  size: string | null
  unit_price: number | null
  unit_cost: number | null
}

type ModelRow = {
  id: string
  name: string
  is_active: boolean
  main_image_url?: string | null
  product_variants: Variant[] | null
}

type ProductListClientProps = {
  models: ModelRow[]
}

const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
type SortKey =
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc'
  | 'cost_asc'
  | 'cost_desc'

const sortSizes = (sizes: string[]) =>
  sizes.sort((a, b) => {
    const aIndex = sizeOrder.indexOf(a)
    const bIndex = sizeOrder.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

const formatRange = (values: number[]) => {
  if (!values.length) return '—'
  if (values.length === 1) return formatMoney(values[0])
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return formatMoney(min)
  return `${formatMoney(min)}–${formatMoney(max)}`
}

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
)

export default function ProductListClient({ models }: ProductListClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('name_asc')

  const handleArchive = (modelId: string) => {
    setPendingId(modelId)
    startTransition(async () => {
      const result = await archiveModel(modelId)
      if (!result?.error) {
        router.refresh()
      }
      setPendingId(null)
    })
  }

  const modelRows = useMemo(() => {
    return models.map((model) => {
      const variants = model.product_variants ?? []
      const sizes = sortSizes(
        Array.from(
          new Set(variants.map((variant) => variant.size).filter(Boolean) as string[])
        )
      )
      const prices = Array.from(
        new Set(
          variants
            .map((variant) => variant.unit_price)
            .filter((value): value is number => typeof value === 'number')
        )
      )
      const costs = Array.from(
        new Set(
          variants
            .map((variant) => variant.unit_cost)
            .filter((value): value is number => typeof value === 'number')
        )
      )

      return {
        ...model,
        sizes,
        prices,
        costs,
        minPrice: prices.length ? Math.min(...prices) : null,
        minCost: costs.length ? Math.min(...costs) : null
      }
    })
  }, [models])

  const sizeOptions = useMemo(() => {
    return sortSizes(
      Array.from(new Set(modelRows.flatMap((model) => model.sizes)))
    )
  }, [modelRows])

  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = modelRows.filter((model) => {
      if (sizeFilter && !model.sizes.includes(sizeFilter)) return false
      if (!query) return true

      const haystack = [
        model.name,
        model.sizes.join(' '),
        model.prices.map((value) => String(value)).join(' '),
        model.costs.map((value) => String(value)).join(' ')
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })

    const withFallback = (value: number | null, asc: boolean) => {
      if (value === null) return asc ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER
      return value
    }

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name_desc':
          return b.name.localeCompare(a.name, 'ru')
        case 'price_asc':
          return withFallback(a.minPrice, true) - withFallback(b.minPrice, true)
        case 'price_desc':
          return withFallback(b.minPrice, false) - withFallback(a.minPrice, false)
        case 'cost_asc':
          return withFallback(a.minCost, true) - withFallback(b.minCost, true)
        case 'cost_desc':
          return withFallback(b.minCost, false) - withFallback(a.minCost, false)
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name, 'ru')
      }
    })
  }, [modelRows, searchQuery, sizeFilter, sortBy])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <input
          className="rounded-xl border border-slate-200 px-3 py-2"
          placeholder="Поиск по названию, размеру, цене"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={sizeFilter}
          onChange={(event) => setSizeFilter(event.target.value)}
        >
          <option value="">Все размеры</option>
          {sizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortKey)}
        >
          <option value="name_asc">Сортировка: Название (А-Я)</option>
          <option value="name_desc">Сортировка: Название (Я-А)</option>
          <option value="price_asc">Цена: по возрастанию</option>
          <option value="price_desc">Цена: по убыванию</option>
          <option value="cost_asc">Себестоимость: по возрастанию</option>
          <option value="cost_desc">Себестоимость: по убыванию</option>
        </select>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Фото</TH>
            <TH>Название</TH>
            <TH>Размеры</TH>
            <TH>Стоимость</TH>
            <TH>Себестоимость</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {filteredModels.length ? (
            filteredModels.map((model) => (
              <TR
                key={model.id}
                className="cursor-pointer"
                onClick={() => router.push(`/products/${model.id}`)}
              >
                <TD>
                  {model.main_image_url ? (
                    <img
                      src={model.main_image_url}
                      alt={model.name}
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl border border-dashed border-slate-200 bg-slate-50/80" />
                  )}
                </TD>
                <TD className="font-medium text-slate-900">{model.name}</TD>
                <TD>{model.sizes.length ? model.sizes.join(', ') : '—'}</TD>
                <TD>{formatRange(model.prices)}</TD>
                <TD>{formatRange(model.costs)}</TD>
                <TD className="text-right">
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/70 p-0 text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleArchive(model.id)
                    }}
                    disabled={!model.is_active || (isPending && pendingId === model.id)}
                    aria-label="Архивировать"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </TD>
              </TR>
            ))
          ) : (
            <TR>
              <TD colSpan={6} className="text-center text-slate-500">
                Ничего не найдено по выбранным параметрам
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
    </div>
  )
}
