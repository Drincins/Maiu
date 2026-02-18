'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Button } from '@/components/Button'
import StorageUploader from '@/components/StorageUploader'
import { bulkUpdateVariantPrices, deleteModel, updateModel, updateVariantDetails } from './actions'
import { formatMoney, intToMoneyInput, moneyToInt } from '@/lib/money'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { Badge } from '@/components/Badge'

const modelSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  main_image_url: z.string().optional(),
  is_active: z.boolean().optional()
})

type ModelFormValues = z.infer<typeof modelSchema>

type Model = {
  id: string
  name: string
  description: string | null
  main_image_url: string | null
  is_active: boolean
}

type Variant = {
  id: string
  sku: string
  size: string | null
  color: string | null
  barcode: string | null
  unit_price: number
  unit_cost: number
  is_marked: boolean
  image_url: string | null
}

type ProductDetailClientProps = {
  model: Model
  variants: Variant[]
}

const PencilIcon = ({ className }: { className?: string }) => (
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
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
  </svg>
)

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

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10)

const dateInputToIso = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return new Date().toISOString()
  const parsed = new Date(`${normalized}T00:00:00`)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed.toISOString()
}

export default function ProductDetailClient({
  model,
  variants
}: ProductDetailClientProps) {
  const router = useRouter()
  const [modelError, setModelError] = useState<string | null>(null)
  const [modelPending, startModelTransition] = useTransition()
  const [pricePending, startPriceTransition] = useTransition()
  const [pendingVariantId, setPendingVariantId] = useState<string | null>(null)
  const [variantError, setVariantError] = useState<string | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [priceSuccess, setPriceSuccess] = useState<string | null>(null)
  const [bulkPrice, setBulkPrice] = useState('')
  const [priceEffectiveDate, setPriceEffectiveDate] = useState(() =>
    toDateInputValue(new Date())
  )
  const [editVariantId, setEditVariantId] = useState<string | null>(null)
  const [variantDrafts, setVariantDrafts] = useState<
    Record<string, { size: string; color: string; price: string; cost: string }>
  >(() => {
    const initialDrafts: Record<
      string,
      { size: string; color: string; price: string; cost: string }
    > = {}
    variants.forEach((variant) => {
      initialDrafts[variant.id] = {
        size: variant.size ?? '',
        color: variant.color ?? '',
        price: intToMoneyInput(variant.unit_price),
        cost: intToMoneyInput(variant.unit_cost)
      }
    })
    return initialDrafts
  })

  const modelForm = useForm<ModelFormValues>({
    resolver: zodResolver(modelSchema),
    defaultValues: {
      name: model.name,
      description: model.description ?? '',
      main_image_url: model.main_image_url ?? '',
      is_active: model.is_active
    }
  })

  useEffect(() => {
    setVariantDrafts((prev) => {
      const next = { ...prev }
      variants.forEach((variant) => {
        if (editVariantId === variant.id) return
        next[variant.id] = {
          size: variant.size ?? '',
          color: variant.color ?? '',
          price: intToMoneyInput(variant.unit_price),
          cost: intToMoneyInput(variant.unit_cost)
        }
      })
      return next
    })
  }, [variants, editVariantId])

  const submitModel = (values: ModelFormValues) => {
    setModelError(null)
    startModelTransition(async () => {
      const result = await updateModel(model.id, {
        ...values,
        main_image_url: values.main_image_url || null
      })
      if (result?.error) {
        setModelError(result.error)
      }
    })
  }

  const handleDelete = () => {
    if (!confirm("Удалить карточку товара?")) return
    setModelError(null)
    startModelTransition(async () => {
      const result = await deleteModel(model.id)
      if (result?.error) {
        setModelError(result.error)
        return
      }
      window.location.href = '/products'
    })
  }

  const parseMoneyInput = (value: string) => {
    const normalized = value.replace(',', '.').replace(/\s/g, '')
    if (!normalized) return null
    const parsed = Number.parseFloat(normalized)
    if (!Number.isFinite(parsed)) return null
    return moneyToInt(normalized)
  }

  const updateVariantDraft = (
    variantId: string,
    patch: Partial<{ size: string; color: string; price: string; cost: string }>
  ) => {
    setVariantDrafts((prev) => {
      const current = prev[variantId] ?? { size: '', color: '', price: '', cost: '' }
      return {
        ...prev,
        [variantId]: {
          ...current,
          ...patch
        }
      }
    })
  }

  const resetVariantDraft = (variant: Variant) => {
    setVariantDrafts((prev) => ({
      ...prev,
      [variant.id]: {
        size: variant.size ?? '',
        color: variant.color ?? '',
        price: intToMoneyInput(variant.unit_price),
        cost: intToMoneyInput(variant.unit_cost)
      }
    }))
  }

  const handleVariantSave = (variant: Variant) => {
    const draft = variantDrafts[variant.id]
    if (!draft) return

    const unitPrice = parseMoneyInput(draft.price)
    if (unitPrice === null) {
      setPriceSuccess(null)
      setVariantError('Enter a valid price')
      return
    }

    const unitCost = parseMoneyInput(draft.cost)
    if (unitCost === null) {
      setPriceSuccess(null)
      setVariantError('Enter a valid cost')
      return
    }

    const effectiveAt = dateInputToIso(priceEffectiveDate)
    if (!effectiveAt) {
      setPriceSuccess(null)
      setVariantError('Enter a valid effective date')
      return
    }

    setPriceSuccess(null)
    setBulkError(null)
    setVariantError(null)
    setPendingVariantId(variant.id)

    startPriceTransition(async () => {
      const result = await updateVariantDetails(variant.id, {
        size: draft.size.trim() || null,
        color: draft.color.trim() || null,
        unit_price: unitPrice,
        unit_cost: unitCost,
        price_effective_at: effectiveAt
      })

      if (result?.error) {
        setVariantError(result.error)
      } else {
        setPriceSuccess(
          `Price effective from ${priceEffectiveDate}. Recalculated ${result?.recalculatedLines ?? 0} operation lines and ${result?.recalculatedMovements ?? 0} stock movements.`
        )
        setEditVariantId(null)
        router.refresh()
      }

      setPendingVariantId(null)
    })
  }

  const handleBulkPriceSave = () => {
    const cents = parseMoneyInput(bulkPrice)
    if (cents === null) {
      setPriceSuccess(null)
      setBulkError('Enter a valid price')
      return
    }

    const effectiveAt = dateInputToIso(priceEffectiveDate)
    if (!effectiveAt) {
      setPriceSuccess(null)
      setBulkError('Enter a valid effective date')
      return
    }

    setPriceSuccess(null)
    setVariantError(null)
    setBulkError(null)

    startPriceTransition(async () => {
      const result = await bulkUpdateVariantPrices(model.id, cents, effectiveAt)

      if (result?.error) {
        setBulkError(result.error)
      } else {
        setPriceSuccess(
          `Price effective from ${priceEffectiveDate} for ${result?.updatedVariants ?? variants.length} SKU. Recalculated ${result?.recalculatedLines ?? 0} operation lines and ${result?.recalculatedMovements ?? 0} stock movements.`
        )
        setBulkPrice('')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form onSubmit={modelForm.handleSubmit(submitModel)} className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Карточка модели</h2>
              <Badge tone={model.is_active ? 'success' : 'warning'}>
                {model.is_active ? 'Активно' : 'Архив'}
              </Badge>
            </div>
            <Link href={`/products/${model.id}/tech-card`}>
              <Button type="button" variant="secondary">
                Техкарта
              </Button>
            </Link>
          </div>
          <Field label="Название" error={modelForm.formState.errors.name?.message}>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...modelForm.register('name')}
            />
          </Field>
          
          <Field label="Описание">
            <textarea
              className="min-h-[90px] rounded-xl border border-slate-200 px-3 py-2"
              {...modelForm.register('description')}
            />
          </Field>
          <Field label="Фото модели">
            <StorageUploader
              bucket="product-images"
              onUploaded={(url) => modelForm.setValue('main_image_url', url)}
            />
            {modelForm.watch('main_image_url') ? (
              <img
                src={modelForm.watch('main_image_url') as string}
                alt="model"
                className="mt-2 h-28 w-28 rounded-xl object-cover"
              />
            ) : null}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...modelForm.register('is_active')} />
            Активная модель
          </label>
          {modelError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {modelError}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" disabled={modelPending}>
              Сохранить изменения
            </Button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
              onClick={handleDelete}
              disabled={modelPending}
              title="Удалить карточку товара"
              aria-label="Удалить карточку товара"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">SKU</h2>
          <span className="text-sm text-slate-500">{variants.length} шт.</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto] sm:items-end">
          <Field label="New price for all SKU">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              placeholder="For example 1990.00"
              value={bulkPrice}
              onChange={(event) => setBulkPrice(event.target.value)}
            />
          </Field>
          <Field label="Effective from date">
            <input
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={priceEffectiveDate}
              onChange={(event) => setPriceEffectiveDate(event.target.value)}
            />
          </Field>
          <Button type="button" onClick={handleBulkPriceSave} disabled={pricePending}>
            Update all
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Selected date is also used when saving price in a single SKU row.
        </p>
        {bulkError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {bulkError}
          </div>
        ) : null}
        {priceSuccess ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {priceSuccess}
          </div>
        ) : null}
        {variantError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {variantError}
          </div>
        ) : null}
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>SKU</TH>
              <TH>Размер</TH>
              <TH>Цвет</TH>
              <TH>Цена</TH>
              <TH>Себестоимость</TH>
              <TH>Маркировка</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {variants.map((variant) => {
              const draft = variantDrafts[variant.id]
              const isEditing = editVariantId === variant.id
              return (
                <TR key={variant.id}>
                  <TD className="font-medium text-slate-900">{variant.sku}</TD>
                  <TD>
                    {isEditing ? (
                      <input
                        className="w-24 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                        value={draft?.size ?? ''}
                        onChange={(event) => updateVariantDraft(variant.id, { size: event.target.value })}
                      />
                    ) : (
                      variant.size ?? '—'
                    )}
                  </TD>
                  <TD>
                    {isEditing ? (
                      <input
                        className="w-28 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                        value={draft?.color ?? ''}
                        onChange={(event) => updateVariantDraft(variant.id, { color: event.target.value })}
                      />
                    ) : (
                      variant.color ?? '—'
                    )}
                  </TD>
                  <TD>
                    {isEditing ? (
                      <input
                        className="w-28 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                        value={draft?.price ?? ''}
                        onChange={(event) => updateVariantDraft(variant.id, { price: event.target.value })}
                      />
                    ) : (
                      formatMoney(variant.unit_price)
                    )}
                  </TD>
                  <TD>
                    {isEditing ? (
                      <input
                        className="w-28 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                        value={draft?.cost ?? ''}
                        onChange={(event) => updateVariantDraft(variant.id, { cost: event.target.value })}
                      />
                    ) : (
                      formatMoney(variant.unit_cost)
                    )}
                  </TD>
                  <TD>{variant.is_marked ? 'Да' : 'Нет'}</TD>
                  <TD>
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleVariantSave(variant)}
                          disabled={
                            pricePending &&
                            (pendingVariantId === null || pendingVariantId === variant.id)
                          }
                        >
                          Сохранить
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            resetVariantDraft(variant)
                            setEditVariantId(null)
                            setVariantError(null)
                          }}
                          disabled={pricePending}
                        >
                          Отмена
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-200 hover:text-brand-700 disabled:opacity-60"
                        onClick={() => {
                          resetVariantDraft(variant)
                          setEditVariantId(variant.id)
                          setVariantError(null)
                        }}
                        disabled={pricePending}
                        title="Редактировать"
                        aria-label="Редактировать"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      </Card>

      
    </div>
  )
}
