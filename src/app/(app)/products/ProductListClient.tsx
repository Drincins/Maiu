'use client'

import { useState, useTransition } from 'react'
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

  return (
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
        {models.map((model) => {
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

          return (
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
              <TD>{sizes.length ? sizes.join(', ') : '—'}</TD>
              <TD>{formatRange(prices)}</TD>
              <TD>{formatRange(costs)}</TD>
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
          )
        })}
      </TBody>
    </Table>
  )
}
