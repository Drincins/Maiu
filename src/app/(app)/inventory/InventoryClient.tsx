'use client'

import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Button } from '@/components/Button'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { createOperation } from '@/app/(app)/operations/actions'

type StockRow = {
  variant_id: string
  location_id: string
  qty: number
}

type Variant = {
  id: string
  sku: string
  size: string | null
  color: string | null
  is_marked: boolean
  model_id: string
  model: {
    name: string
    is_active: boolean
  } | null
}

type Location = {
  id: string
  name: string
  type: string
}

type InventoryClientProps = {
  stock: StockRow[]
  variants: Variant[]
  locations: Location[]
}

type SortKey =
  | 'sku_asc'
  | 'sku_desc'
  | 'model_asc'
  | 'model_desc'
  | 'location_asc'
  | 'location_desc'
  | 'qty_asc'
  | 'qty_desc'

export default function InventoryClient({ stock, variants, locations }: InventoryClientProps) {
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [draftState, setDraftState] = useState<Record<string, { checked: boolean; qty: string }>>({})
  const [inboundState, setInboundState] = useState<Record<string, { qty: string }>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showInboundForm, setShowInboundForm] = useState(false)
  const [occurredDate, setOccurredDate] = useState('')
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('qty_desc')
  const [onlyActive, setOnlyActive] = useState(true)

  useEffect(() => {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    const today = local.toISOString().slice(0, 10)
    setOccurredDate((prev) => prev || today)
  }, [])

  const variantMap = useMemo(() => {
    return new Map(variants.map((variant) => [variant.id, variant]))
  }, [variants])

  const locationMap = useMemo(() => {
    return new Map(locations.map((location) => [location.id, location]))
  }, [locations])

  const sizes = Array.from(
    new Set(
      variants
        .map((variant) => variant.size)
        .filter((value): value is string => Boolean(value))
    )
  )
  const colors = Array.from(
    new Set(
      variants
        .map((variant) => variant.color)
        .filter((value): value is string => Boolean(value))
    )
  )

  const models = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null }>()
    variants.forEach((variant) => {
      if (!variant.model) return
      if (!map.has(variant.model_id)) {
        map.set(variant.model_id, {
          id: variant.model_id,
          name: variant.model.name,
          color: variant.color ?? null
        })
      }
    })
    return Array.from(map.values())
  }, [variants])

  const modelVariants = useMemo(
    () => variants.filter((variant) => variant.model_id === selectedModelId),
    [variants, selectedModelId]
  )

  const warehouseLocations = useMemo(() => {
    const warehouseTypes = new Set(['sales', 'promo', 'other'])
    const map = new Map<string, Location>()
    locations
      .filter((location) => warehouseTypes.has(location.type))
      .forEach((location) => {
        if (!map.has(location.name)) {
          map.set(location.name, location)
        }
      })
    return Array.from(map.values())
  }, [locations])

  const canSelectItems = Boolean(selectedLocationId && occurredDate)

  const draftLines = useMemo(() => {
    return modelVariants
      .map((variant) => {
        const state = draftState[variant.id]
        if (!state?.checked) return null
        const qty = Number(state.qty)
        if (!qty || qty <= 0) return null
        return { variant, qty }
      })
      .filter(Boolean) as Array<{ variant: Variant; qty: number }>
  }, [modelVariants, draftState])

  const inboundLines = useMemo(() => {
    return variants
      .map((variant) => {
        const state = inboundState[variant.id]
        if (!state) return null
        const qty = Number(state.qty)
        if (!qty || qty <= 0) return null
        return { variant, qty }
      })
      .filter(Boolean) as Array<{ variant: Variant; qty: number }>
  }, [variants, inboundState])

  useEffect(() => {
    if (!selectedModelId) {
      setDraftState({})
      return
    }
    const next: Record<string, { checked: boolean; qty: string }> = {}
    modelVariants.forEach((variant) => {
      const existing = inboundState[variant.id]
      next[variant.id] = {
        checked: Boolean(existing),
        qty: existing?.qty ?? ''
      }
    })
    setDraftState(next)
  }, [selectedModelId, modelVariants, inboundState])

  const handleToggleAll = (checked: boolean) => {
    setDraftState((prev) => {
      const next = { ...prev }
      modelVariants.forEach((variant) => {
        next[variant.id] = {
          checked,
          qty: prev[variant.id]?.qty ?? ''
        }
      })
      return next
    })
  }

  const commitDraft = () => {
    if (!selectedModelId) {
      setFormError('Выберите товар')
      return
    }
    if (!draftLines.length) {
      setFormError('Укажите количество хотя бы для одного размера')
      return
    }
    setInboundState((prev) => {
      const next = { ...prev }
      draftLines.forEach(({ variant, qty }) => {
        next[variant.id] = { qty: String(qty) }
      })
      return next
    })
    setFormError(null)
    setSelectedModelId('')
    setDraftState({})
  }

  const clearDraft = () => {
    setDraftState({})
  }

  const validateInbound = () => {
    if (!occurredDate) {
      setFormError('Укажите дату прихода')
      return false
    }
    if (!selectedLocationId) {
      setFormError('Выберите склад')
      return false
    }
    if (!inboundLines.length) {
      setFormError('Укажите количество хотя бы для одного размера')
      return false
    }
    setFormError(null)
    return true
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!validateInbound()) return
    startTransition(async () => {
      const occurredAt = occurredDate
        ? new Date(`${occurredDate}T12:00:00`).toISOString()
        : new Date().toISOString()
      const result = await createOperation({
        type: 'inbound',
        occurred_at: occurredAt,
        to_location_id: selectedLocationId,
        lines: inboundLines.map(({ variant, qty }) => ({
          variant_id: variant.id,
          qty
        }))
      })
      if (result?.error) {
        setFormError(result.error)
        return
      }
      setShowInboundForm(false)
      window.location.reload()
    })
  }

  const rows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const nextRows = stock
      .map((row) => {
        const variant = variantMap.get(row.variant_id)
        const location = locationMap.get(row.location_id)
        return {
          ...row,
          variant,
          location
        }
      })
      .filter((row) => row.variant && row.location)
      .filter((row) => {
        if (onlyActive && row.variant?.model?.is_active === false) return false
        if (size && row.variant?.size !== size) return false
        if (color && row.variant?.color !== color) return false
        if (locationFilter && row.location_id !== locationFilter) return false
        if (!query) return true

        const haystack = [
          row.variant?.sku ?? '',
          row.variant?.model?.name ?? '',
          row.variant?.size ?? '',
          row.variant?.color ?? '',
          row.location?.name ?? ''
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(query)
      })

    return [...nextRows].sort((a, b) => {
      const skuA = a.variant?.sku ?? ''
      const skuB = b.variant?.sku ?? ''
      const modelA = a.variant?.model?.name ?? ''
      const modelB = b.variant?.model?.name ?? ''
      const locationA = a.location?.name ?? ''
      const locationB = b.location?.name ?? ''

      switch (sortBy) {
        case 'sku_desc':
          return skuB.localeCompare(skuA, 'ru')
        case 'model_asc':
          return modelA.localeCompare(modelB, 'ru')
        case 'model_desc':
          return modelB.localeCompare(modelA, 'ru')
        case 'location_asc':
          return locationA.localeCompare(locationB, 'ru')
        case 'location_desc':
          return locationB.localeCompare(locationA, 'ru')
        case 'qty_asc':
          return a.qty - b.qty
        case 'qty_desc':
          return b.qty - a.qty
        case 'sku_asc':
        default:
          return skuA.localeCompare(skuB, 'ru')
      }
    })
  }, [
    stock,
    variantMap,
    locationMap,
    onlyActive,
    size,
    color,
    locationFilter,
    searchQuery,
    sortBy
  ])

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Приход на склад</h2>
          <p className="text-sm text-slate-600">Добавить товар на склад</p>
        </div>
        <Button type="button" onClick={() => setShowInboundForm(true)}>
          Поставить на приход
        </Button>
      </Card>

      {showInboundForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="flex w-full max-w-3xl flex-col rounded-3xl border border-slate-200/70 bg-white/95 p-6 shadow-[0_30px_70px_rgba(36,31,26,0.25)] max-h-[90vh]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Приход на склад</h3>
                <p className="text-sm text-slate-600">Заполните параметры прихода</p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setShowInboundForm(false)}>
                Закрыть
              </Button>
            </div>
            <div className="mt-4 min-h-0 overflow-y-auto pr-1">
              <form onSubmit={handleSubmit} className="grid gap-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-semibold text-slate-900">Параметры прихода</h4>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Шаг 1</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Дата прихода">
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      value={occurredDate}
                      onChange={(event) => setOccurredDate(event.target.value)}
                    />
                  </Field>
                  <Field label="Склад">
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      value={selectedLocationId}
                      onChange={(event) => setSelectedLocationId(event.target.value)}
                    >
                      <option value="">—</option>
                      {warehouseLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-base font-semibold text-slate-900">Товары</h4>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Шаг 2</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Товар">
                      <select
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
                        value={selectedModelId}
                        onChange={(event) => setSelectedModelId(event.target.value)}
                        disabled={!canSelectItems}
                      >
                        <option value="">—</option>
                        {models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}{model.color ? ` · ${model.color}` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="text-xs text-slate-500 md:pt-8">
                      Сначала отметьте размеры, затем нажмите «Добавить в список».
                    </div>
                  </div>

                  {!canSelectItems ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Сначала укажите дату прихода и склад, затем добавляйте товары.
                    </div>
                  ) : null}

                  {canSelectItems && selectedModelId && modelVariants.length ? (
                    <div className="grid gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Размеры и количество
                        </span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleToggleAll(true)}
                          >
                            Выбрать все
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleToggleAll(false)}
                          >
                            Снять все
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {modelVariants.map((variant) => (
                          <div
                            key={variant.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2"
                          >
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={draftState[variant.id]?.checked ?? false}
                                onChange={(event) =>
                                  setDraftState((prev) => ({
                                    ...prev,
                                    [variant.id]: {
                                      checked: event.target.checked,
                                      qty: prev[variant.id]?.qty ?? ''
                                    }
                                  }))
                                }
                              />
                              {variant.size ?? '—'}
                            </label>
                            <input
                              type="number"
                              min={0}
                              className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                              value={draftState[variant.id]?.qty ?? ''}
                              onChange={(event) =>
                                setDraftState((prev) => ({
                                  ...prev,
                                  [variant.id]: {
                                    checked: prev[variant.id]?.checked ?? false,
                                    qty: event.target.value
                                  }
                                }))
                              }
                              placeholder="0"
                              disabled={!draftState[variant.id]?.checked}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={commitDraft}
                          disabled={!draftLines.length}
                        >
                          Добавить в список
                        </Button>
                        <Button type="button" variant="ghost" onClick={clearDraft}>
                          Очистить
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {inboundLines.length ? (
                  <div className="grid gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Список прихода
                      </span>
                      <span className="text-xs text-slate-500">
                        Позиций: {inboundLines.length}
                      </span>
                    </div>
                    <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-1">
                      {inboundLines.map(({ variant }) => {
                        const detail = [variant.size, variant.color].filter(Boolean).join(' · ')
                        return (
                          <div
                            key={variant.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white px-3 py-2"
                          >
                            <div>
                              <div className="text-sm font-medium text-slate-900">
                                {variant.model?.name ?? '—'}
                              </div>
                              <div className="text-xs text-slate-500">{detail || '—'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                                value={inboundState[variant.id]?.qty ?? ''}
                                onChange={(event) =>
                                  setInboundState((prev) => ({
                                    ...prev,
                                    [variant.id]: {
                                      qty: event.target.value
                                    }
                                  }))
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setInboundState((prev) => {
                                    const next = { ...prev }
                                    delete next[variant.id]
                                    return next
                                  })
                                }
                              >
                                Убрать
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {!inboundLines.length ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                    Добавьте товары в список, чтобы оприходовать сразу несколько позиций.
                  </div>
                ) : null}

                {formError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    {formError}
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <Button type="submit" disabled={isPending}>
                    Поставить на приход
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
            Размер
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
            value={size}
            onChange={(event) => setSize(event.target.value)}
          >
            <option value="">Все</option>
            {sizes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
            Цвет
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          >
            <option value="">Все</option>
            {colors.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
            Локация
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
          >
            <option value="">Все</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
            Поиск
          </span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
            placeholder="SKU, модель, размер, цвет, локация"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
            Сортировка
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortKey)}
          >
            <option value="qty_desc">Остаток: по убыванию</option>
            <option value="qty_asc">Остаток: по возрастанию</option>
            <option value="sku_asc">SKU: А-Я</option>
            <option value="sku_desc">SKU: Я-А</option>
            <option value="model_asc">Модель: А-Я</option>
            <option value="model_desc">Модель: Я-А</option>
            <option value="location_asc">Локация: А-Я</option>
            <option value="location_desc">Локация: Я-А</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(event) => setOnlyActive(event.target.checked)}
          />
          Только активные
        </label>
      </Card>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>SKU</TH>
              <TH>Модель</TH>
              <TH>Размер</TH>
              <TH>Цвет</TH>
              <TH>Локация</TH>
              <TH>Остаток</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length ? (
              rows.map((row) => (
                <TR key={`${row.variant_id}-${row.location_id}`}>
                  <TD className="font-medium text-slate-900">{row.variant?.sku}</TD>
                  <TD>{row.variant?.model?.name ?? '—'}</TD>
                  <TD>{row.variant?.size ?? '—'}</TD>
                  <TD>{row.variant?.color ?? '—'}</TD>
                  <TD>{row.location?.name ?? '—'}</TD>
                  <TD className="font-semibold text-slate-900">{row.qty}</TD>
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
      </Card>

          </div>
  )
}
