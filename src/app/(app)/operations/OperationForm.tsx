'use client'

import { useState, useTransition, useEffect, Fragment } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import MarkCodeScanner from '@/components/MarkCodeScanner'
import { createOperation, updateOperation } from './actions'
import { formatMoney, intToMoneyInput, moneyToInt } from '@/lib/money'

const lineSchema = z.object({
  variant_id: z.string().min(1, 'Выберите SKU'),
  qty: z.coerce.number().int().positive(),
  unit_price_snapshot: z.string().optional(),
  line_note: z.string().optional(),
  mark_codes: z.array(z.string()).optional(),
  marking_not_handled: z.boolean().optional()
})

const schema = z.object({
  type: z.enum([
    'inbound',
    'transfer',
    'ship_blogger',
    'return_blogger',
    'sale',
    'sale_return',
    'writeoff',
    'adjustment'
  ]),
  occurred_at: z.string().min(1),
  from_location_id: z.string().optional().nullable(),
  to_location_id: z.string().optional().nullable(),
  counterparty_id: z.string().optional().nullable(),
  promo_code_id: z.string().optional().nullable(),
  sale_channel: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  delivery_cost: z.string().optional().nullable(),
  delivery_service: z.string().optional().nullable(),
  tracking_number: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(1, 'Добавьте хотя бы один товар')
}).superRefine((values, ctx) => {
  const hasCounterparty = Boolean(values.counterparty_id && values.counterparty_id.trim().length > 0)
  if (values.type === 'ship_blogger' && !hasCounterparty) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['counterparty_id'],
      message: 'Выберите блогера'
    })
  }
})

export type OperationFormValues = z.infer<typeof schema>

type Variant = {
  id: string
  sku: string
  size: string | null
  color: string | null
  unit_price: number
  unit_cost: number
  is_marked: boolean
}

type Location = {
  id: string
  name: string
  type: string
}

type PromoCode = {
  id: string
  code: string
}

type Counterparty = {
  id: string
  name: string
}

type OperationFormProps = {
  variants: Variant[]
  locations: Location[]
  promoCodes: PromoCode[]
  counterparties: Counterparty[]
  operationId?: string
  initialValues?: OperationFormValues
  submitLabel?: string
}

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


const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Запрос выполняется слишком долго. Попробуйте еще раз.'))
    }, ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

const actionTimeoutMs = 15000

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
export default function OperationForm({
  variants,
  locations,
  promoCodes,
  counterparties,
  operationId,
  initialValues,
  submitLabel
}: OperationFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showLineModal, setShowLineModal] = useState(false)
  const [lineError, setLineError] = useState<string | null>(null)
  const [reversePendingIndex, setReversePendingIndex] = useState<number | null>(null)
  const [reverseOperationPending, setReverseOperationPending] = useState(false)
  const [lineDraft, setLineDraft] = useState({
    variant_id: '',
    qty: 1,
    unit_price_snapshot: '',
    line_note: ''
  })

  const locationByType = (type: string) =>
    locations.find((location) => location.type === type)
  const locationIdByType = (type: string) => locationByType(type)?.id

  const dedupeByName = (items: Location[]) => {
    const map = new Map<string, Location>()
    items.forEach((item) => {
      if (!map.has(item.name)) {
        map.set(item.name, item)
      }
    })
    return Array.from(map.values())
  }
  const warehouseTypes = new Set(['sales', 'promo', 'other'])
  const warehouseLocations = dedupeByName(
    locations.filter((location) => warehouseTypes.has(location.type))
  )
  const salesLocations = [
    { type: 'sold', label: 'Клиент' },
    { type: 'blogger', label: 'Блогер' },
    { type: 'scrap', label: 'Брак/Списание' }
  ]
    .map((option) => {
      const location = locationByType(option.type)
      return location ? { ...location, label: option.label } : null
    })
    .filter(Boolean) as Array<Location & { label: string }>

  const form = useForm<OperationFormValues>({
    resolver: zodResolver(schema),
    defaultValues:
      initialValues ?? ({
        type: 'sale',
        occurred_at: '',
        counterparty_id: '',
        lines: []
      } as OperationFormValues)
  })

  useEffect(() => {
    if (initialValues?.occurred_at) return
    const current = form.getValues('occurred_at')
    if (current) return
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    form.setValue('occurred_at', local.toISOString().slice(0, 16), {
      shouldDirty: false
    })
  }, [form, initialValues])

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines'
  })

  const selectedType = form.watch('type')
  const draftVariant = variants.find((item) => item.id === lineDraft.variant_id)
  const lineFormError = form.formState.errors.lines?.message as string | undefined
  const counterpartyFormError = form.formState.errors.counterparty_id?.message as
    | string
    | undefined

  useEffect(() => {
    if (selectedType === 'sale') {
      form.setValue('from_location_id', form.getValues('from_location_id') || locationIdByType('sales'))
      form.setValue('to_location_id', form.getValues('to_location_id') || locationIdByType('sold'))
    }
    if (selectedType === 'ship_blogger') {
      form.setValue(
        'from_location_id',
        form.getValues('from_location_id') ||
          locationIdByType('promo') ||
          locationIdByType('sales')
      )
    }
    if (selectedType === 'return_blogger') {
      form.setValue(
        'to_location_id',
        form.getValues('to_location_id') ||
          locationIdByType('promo') ||
          locationIdByType('sales')
      )
      form.setValue(
        'from_location_id',
        form.getValues('from_location_id') || locationIdByType('blogger')
      )
    }
    if (selectedType === 'writeoff') {
      form.setValue('to_location_id', form.getValues('to_location_id') || locationIdByType('scrap'))
    }
    if (selectedType === 'sale_return') {
      form.setValue('from_location_id', form.getValues('from_location_id') || locationIdByType('sold'))
      form.setValue('to_location_id', form.getValues('to_location_id') || locationIdByType('sales'))
    }
    if (selectedType !== 'ship_blogger' && selectedType !== 'return_blogger') {
      form.setValue('counterparty_id', '')
    }
  }, [selectedType, locations])

  const handleSubmit = (values: OperationFormValues) => {
    setServerError(null)

    const normalize = (value?: string | null) =>
      value && value.length > 0 ? value : null

    const normalizedToLocationId = normalize(values.to_location_id)
    const payload = {
      ...values,
      occurred_at: new Date(values.occurred_at).toISOString(),
      from_location_id: normalize(values.from_location_id),
      // For blogger shipment the destination location is derived from counterparty on the server.
      to_location_id: values.type === 'ship_blogger' ? null : normalizedToLocationId,
      counterparty_id: normalize(values.counterparty_id),
      promo_code_id: normalize(values.promo_code_id),
      sale_channel: normalize(values.sale_channel),
      city: normalize(values.city),
      delivery_cost: values.delivery_cost ? moneyToInt(values.delivery_cost) : null,
      delivery_service: normalize(values.delivery_service),
      tracking_number: normalize(values.tracking_number),
      note: normalize(values.note),
      lines: values.lines.map((line) => ({
        ...line,
        unit_price_snapshot: line.unit_price_snapshot
          ? moneyToInt(line.unit_price_snapshot)
          : undefined
      }))
    }

    startTransition(async () => {
      try {
        const result = operationId
          ? await withTimeout(updateOperation(operationId, payload), actionTimeoutMs)
          : await withTimeout(createOperation(payload), actionTimeoutMs)
        if (result?.error) {
          setServerError(result.error)
          return
        }
        window.location.href = '/operations'
      } catch (error) {
        setServerError(error instanceof Error ? error.message : 'Unexpected error')
      }
    })
  }

  const normalizeValue = (value?: string | null) =>
    value && value.length > 0 ? value : null

  const getReverseType = (type: OperationFormValues['type']) => {
    switch (type) {
      case 'sale':
        return 'sale_return'
      case 'sale_return':
        return 'sale'
      case 'ship_blogger':
        return 'return_blogger'
      case 'return_blogger':
        return 'ship_blogger'
      case 'transfer':
        return 'transfer'
      case 'writeoff':
        return 'transfer'
      default:
        return null
    }
  }

  const handleReverseLine = (index: number) => {
    if (!operationId) return
    setServerError(null)
    const values = form.getValues()
    const line = values.lines?.[index]
    if (!line?.variant_id) {
      setServerError('Выберите товар для возврата')
      return
    }

    const reverseType = getReverseType(values.type)
    if (!reverseType) {
      setServerError('Возврат для этого типа операции недоступен')
      return
    }

    const fromLocation = values.from_location_id || null
    const toLocation = values.to_location_id || null
    if (!fromLocation || !toLocation) {
      setServerError('Для возврата нужны заполненные "Откуда" и "Куда"')
      return
    }

    const codes = line.mark_codes ?? []
    const markingNotHandled =
      line.marking_not_handled ?? (codes.length !== Number(line.qty ?? 0))

    const payload = {
      type: reverseType,
      occurred_at: new Date().toISOString(),
      from_location_id: toLocation,
      to_location_id: fromLocation,
      counterparty_id: normalizeValue(values.counterparty_id),
      promo_code_id: normalizeValue(values.promo_code_id),
      sale_channel: normalizeValue(values.sale_channel),
      city: normalizeValue(values.city),
      delivery_cost: values.delivery_cost ? moneyToInt(values.delivery_cost) : null,
      delivery_service: normalizeValue(values.delivery_service),
      tracking_number: normalizeValue(values.tracking_number),
      note: values.note
        ? `Возврат по операции ${operationId}: ${values.note}`
        : `Возврат по операции ${operationId}`,
      lines: [
        {
          variant_id: line.variant_id,
          qty: Number(line.qty ?? 0),
          unit_price_snapshot: line.unit_price_snapshot
            ? moneyToInt(line.unit_price_snapshot)
            : undefined,
          line_note: line.line_note,
          mark_codes: codes,
          marking_not_handled: markingNotHandled
        }
      ]
    }

    setReversePendingIndex(index)
    startTransition(async () => {
      try {
        const result = await withTimeout(createOperation(payload), actionTimeoutMs)
        if (result?.error) {
          setServerError(result.error)
          setReversePendingIndex(null)
          return
        }
        window.location.href = `/operations/${result.id}`
      } catch (error) {
        setServerError(error instanceof Error ? error.message : 'Unexpected error')
        setReversePendingIndex(null)
      }
    })
  }

  const handleReverseOperation = () => {
    if (!operationId) return
    setServerError(null)
    const values = form.getValues()
    const reverseType = getReverseType(values.type)
    if (!reverseType) {
      setServerError('Возврат для этого типа операции недоступен')
      return
    }

    const fromLocation = values.from_location_id || null
    const toLocation = values.to_location_id || null
    if (!fromLocation || !toLocation) {
      setServerError('Для возврата нужны заполненные "Откуда" и "Куда"')
      return
    }

    const lines = (values.lines ?? []).map((line) => {
      const qty = Number(line.qty ?? 0)
      const codes = line.mark_codes ?? []
      const markingNotHandled =
        line.marking_not_handled ?? (codes.length !== qty)
      return {
        variant_id: line.variant_id,
        qty,
        unit_price_snapshot: line.unit_price_snapshot
          ? moneyToInt(line.unit_price_snapshot)
          : undefined,
        line_note: line.line_note,
        mark_codes: codes,
        marking_not_handled: markingNotHandled
      }
    })

    if (!lines.length) {
      setServerError('В операции нет строк для возврата')
      return
    }

    const payload = {
      type: reverseType,
      occurred_at: new Date().toISOString(),
      from_location_id: toLocation,
      to_location_id: fromLocation,
      counterparty_id: normalizeValue(values.counterparty_id),
      promo_code_id: normalizeValue(values.promo_code_id),
      sale_channel: normalizeValue(values.sale_channel),
      city: normalizeValue(values.city),
      delivery_cost: values.delivery_cost ? moneyToInt(values.delivery_cost) : null,
      delivery_service: normalizeValue(values.delivery_service),
      tracking_number: normalizeValue(values.tracking_number),
      note: values.note
        ? `Возврат по операции ${operationId}: ${values.note}`
        : `Возврат по операции ${operationId}`,
      lines
    }

    setReverseOperationPending(true)
    startTransition(async () => {
      try {
        const result = await withTimeout(createOperation(payload), actionTimeoutMs)
        if (result?.error) {
          setServerError(result.error)
          setReverseOperationPending(false)
          return
        }
        window.location.href = `/operations/${result.id}`
      } catch (error) {
        setServerError(error instanceof Error ? error.message : 'Unexpected error')
        setReverseOperationPending(false)
      }
    })
  }

  const resetLineDraft = () => {
    setLineDraft({
      variant_id: '',
      qty: 1,
      unit_price_snapshot: '',
      line_note: ''
    })
  }

  const handleAddLine = () => {
    const qty = Number(lineDraft.qty)
    if (!lineDraft.variant_id) {
      setLineError('Выберите товар')
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setLineError('Укажите количество')
      return
    }
    append({
      variant_id: lineDraft.variant_id,
      qty,
      unit_price_snapshot: lineDraft.unit_price_snapshot,
      line_note: lineDraft.line_note
    })
    setLineError(null)
    setShowLineModal(false)
    resetLineDraft()
  }

  return (
    <Card>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Тип операции">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('type')}
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Дата">
            <input
              type="datetime-local"
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('occurred_at')}
            />
          </Field>
          <Field label="Откуда">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('from_location_id')}
            >
              <option value="">—</option>
              {warehouseLocations.length ? (
                <optgroup label="Склады">
                  {warehouseLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {salesLocations.length ? (
                <optgroup label="Место продаж">
                  {salesLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </Field>
          <Field
            label="Куда"
            hint={
              selectedType === 'ship_blogger'
                ? 'Для отправки блогеру определяется автоматически'
                : undefined
            }
          >
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              disabled={selectedType === 'ship_blogger'}
              {...form.register('to_location_id')}
            >
              <option value="">—</option>
              {warehouseLocations.length ? (
                <optgroup label="Склады">
                  {warehouseLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {salesLocations.length ? (
                <optgroup label="Место продаж">
                  {salesLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </Field>
          {selectedType === 'ship_blogger' || selectedType === 'return_blogger' ? (
            <Field label="Блогер" error={counterpartyFormError}>
              <select
                className="rounded-xl border border-slate-200 px-3 py-2"
                {...form.register('counterparty_id')}
              >
                <option value="">—</option>
                {counterparties.map((counterparty) => (
                  <option key={counterparty.id} value={counterparty.id}>
                    {counterparty.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Промокод">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('promo_code_id')}
            >
              <option value="">—</option>
              {promoCodes.map((promo) => (
                <option key={promo.id} value={promo.id}>
                  {promo.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Канал продажи">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('sale_channel')}
            >
              <option value="">—</option>
              <option value="Сайт">Сайт</option>
              <option value="Соц Сети">Соц Сети</option>
              <option value="Личная">Личная</option>
            </select>
          </Field>
          <Field label="Город">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('city')}
            />
          </Field>
          <Field label="Доставка">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('delivery_service')}
            >
              <option value="">—</option>
              <option value="СДЭК ПВЗ">СДЭК ПВЗ</option>
              <option value="СДЭК Курьер">СДЭК Курьер</option>
              <option value="Яндекс Такси">Яндекс Такси</option>
              <option value="Личный курьер">Личный курьер</option>
            </select>
          </Field>
          <Field label="Стоимость доставки (₽)">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('delivery_cost')}
            />
          </Field>
          <Field label="Трек-номер">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('tracking_number')}
            />
          </Field>
          <Field label="Комментарий">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('note')}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Товары</h2>
          <div className="flex flex-wrap gap-2">
            {operationId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleReverseOperation}
                disabled={reverseOperationPending || isPending}
              >
                Возврат всей операции
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowLineModal(true)}
            >
              Добавить товар
            </Button>
          </div>
        </div>

        {showLineModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200/70 bg-white/95 p-5 shadow-[0_30px_70px_rgba(36,31,26,0.25)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Добавить товар</h3>
                  <p className="text-sm text-slate-600">Выберите SKU и количество</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowLineModal(false)
                    setLineError(null)
                    resetLineDraft()
                  }}
                >
                  Закрыть
                </Button>
              </div>
              <div className="mt-4 grid gap-3">
                <Field label="SKU">
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2"
                    value={lineDraft.variant_id}
                    onChange={(event) =>
                      setLineDraft((prev) => ({ ...prev, variant_id: event.target.value }))
                    }
                  >
                    <option value="">—</option>
                    {variants.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} {item.size ? `(${item.size})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Кол-во">
                    <input
                      type="number"
                      min={1}
                      className="rounded-xl border border-slate-200 px-3 py-2"
                      value={lineDraft.qty}
                      onChange={(event) =>
                        setLineDraft((prev) => ({ ...prev, qty: Number(event.target.value) }))
                      }
                    />
                  </Field>
                  <Field label="Цена (₽)">
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2"
                      placeholder={
                        draftVariant ? `${intToMoneyInput(draftVariant.unit_price)} ₽` : ''
                      }
                      value={lineDraft.unit_price_snapshot}
                      onChange={(event) =>
                        setLineDraft((prev) => ({
                          ...prev,
                          unit_price_snapshot: event.target.value
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Комментарий">
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2"
                    value={lineDraft.line_note}
                    onChange={(event) =>
                      setLineDraft((prev) => ({ ...prev, line_note: event.target.value }))
                    }
                  />
                </Field>
                {lineError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    {lineError}
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <Button type="button" onClick={handleAddLine}>
                    Добавить
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {fields.length ? (
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Размер</TH>
                <TH>Цвет</TH>
                <TH>Кол-во</TH>
                <TH>Цена</TH>
                <TH>Себестоимость</TH>
                <TH>Комментарий</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {fields.map((field, index) => {
                const variantId = form.watch(`lines.${index}.variant_id`)
                const variant = variants.find((item) => item.id === variantId)
                const isMarked = variant?.is_marked
                const codes = form.watch(`lines.${index}.mark_codes`) ?? []

                return (
                  <Fragment key={field.id}>
                    <TR>
                      <TD className="font-medium text-slate-900">
                        <input
                          type="hidden"
                          {...form.register(`lines.${index}.variant_id` as const)}
                        />
                        {variant?.sku ?? '—'}
                      </TD>
                      <TD>{variant?.size ?? '—'}</TD>
                      <TD>{variant?.color ?? '—'}</TD>
                      <TD>
                        <input
                          type="number"
                          min={1}
                          className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                          {...form.register(`lines.${index}.qty` as const)}
                        />
                      </TD>
                      <TD>
                        <input
                          className="w-28 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                          placeholder={variant ? `${intToMoneyInput(variant.unit_price)} ₽` : ''}
                          {...form.register(`lines.${index}.unit_price_snapshot` as const)}
                        />
                      </TD>
                      <TD className="text-slate-500">
                        {variant ? formatMoney(variant.unit_cost) : '—'}
                      </TD>
                      <TD>
                        <input
                          className="w-full rounded-xl border border-slate-200 px-2 py-1 text-sm"
                          {...form.register(`lines.${index}.line_note` as const)}
                        />
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
                            title="Удалить"
                            aria-label="Удалить"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                          {operationId ? (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleReverseLine(index)}
                              disabled={reversePendingIndex === index || isPending}
                            >
                              Возврат
                            </Button>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                    {isMarked ? (
                      <TR>
                        <TD colSpan={8} className="bg-slate-50/70">
                          <div className="grid gap-3">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                {...form.register(`lines.${index}.marking_not_handled` as const)}
                              />
                              Маркировка не обработана
                            </label>
                            <MarkCodeScanner
                              value={codes}
                              onChange={(next) =>
                                form.setValue(`lines.${index}.mark_codes`, next)
                              }
                            />
                          </div>
                        </TD>
                      </TR>
                    ) : null}
                  </Fragment>
                )
              })}
            </TBody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
            Добавьте товар через кнопку выше
          </div>
        )}
        {lineFormError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {lineFormError}
          </div>
        ) : null}

        {serverError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {serverError}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {submitLabel ?? (operationId ? 'Сохранить изменения' : 'Сохранить операцию')}
          </Button>
        </div>
      </form>
    </Card>
  )
}







