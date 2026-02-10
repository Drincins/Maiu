'use client'

import { useMemo, useState, useTransition } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import StorageUploader from '@/components/StorageUploader'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { formatMoney, intToMoneyInput, moneyToInt } from '@/lib/money'
import { deleteTechCard, upsertTechCard } from '../../actions'

type Model = {
  id: string
  name: string
  main_image_url: string | null
}

type Variant = {
  id: string
  size: string | null
  color: string | null
}

type TechCardLine = {
  name?: string | null
  article?: string | null
  composition?: string | null
  purchase_place?: string | null
  usage?: number | null
  unit_price?: number | null
}

type TechCard = {
  id: string
  sketch_url: string | null
  name: string | null
  color: string | null
  sizes: string[] | null
  lines: TechCardLine[] | null
} | null

const lineSchema = z.object({
  name: z.string().optional(),
  article: z.string().optional(),
  composition: z.string().optional(),
  purchase_place: z.string().optional(),
  usage: z.string().optional(),
  unit_price: z.string().optional()
})

const schema = z.object({
  sketch_url: z.string().optional().nullable(),
  name: z.string().min(1, 'Введите наименование'),
  color: z.string().optional().nullable(),
  sizes: z.array(z.string()),
  lines: z.array(lineSchema)
})

type FormValues = z.infer<typeof schema>

const buildBlankLine = () => ({
  name: '',
  article: '',
  composition: '',
  purchase_place: '',
  usage: '',
  unit_price: ''
})

const normalizeText = (value?: string | null) => {
  const trimmed = (value ?? '').trim()
  return trimmed.length ? trimmed : null
}

const parseUsageInput = (value?: string) => {
  const normalized = (value ?? '').replace(',', '.').replace(/\s/g, '')
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const parseMoneyInput = (value?: string) => {
  const normalized = (value ?? '').replace(',', '.').replace(/\s/g, '')
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) return null
  return moneyToInt(normalized)
}

const computeLineCost = (usage: number | null, unitPrice: number | null) => {
  if (usage === null || unitPrice === null) return 0
  return Math.round(usage * unitPrice)
}

export default function TechCardClient({
  model,
  variants,
  initial
}: {
  model: Model
  variants: Variant[]
  initial: TechCard
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [techCardId, setTechCardId] = useState<string | null>(initial?.id ?? null)
  const [isPending, startTransition] = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()

  const sizeOptions = useMemo(() => {
    const sizes = variants
      .map((variant) => variant.size)
      .filter((size): size is string => Boolean(size))
    const unique = Array.from(new Set(sizes))
    return unique.length ? unique : ['XS', 'S', 'M']
  }, [variants])

  const defaultLines = useMemo(() => {
    const parsed = Array.isArray(initial?.lines) ? initial?.lines ?? [] : []
    if (parsed.length) {
      return parsed.map((line) => ({
        name: line?.name ?? '',
        article: line?.article ?? '',
        composition: line?.composition ?? '',
        purchase_place: line?.purchase_place ?? '',
        usage: line?.usage === null || line?.usage === undefined ? '' : String(line.usage),
        unit_price:
          line?.unit_price === null || line?.unit_price === undefined
            ? ''
            : intToMoneyInput(line.unit_price)
      }))
    }
    return Array.from({ length: 11 }, buildBlankLine)
  }, [initial])

  const initialColor = useMemo(() => {
    const fromVariants = variants.find((variant) => variant.color)?.color ?? ''
    return initial?.color ?? fromVariants
  }, [initial, variants])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sketch_url: initial?.sketch_url ?? model.main_image_url ?? null,
      name: initial?.name ?? model.name,
      color: initialColor,
      sizes: initial?.sizes ?? sizeOptions,
      lines: defaultLines
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines'
  })

  const watchedLines = form.watch('lines')
  const totalCost = useMemo(() => {
    return (watchedLines ?? []).reduce((sum, line) => {
      const usage = parseUsageInput(line?.usage)
      const unitPrice = parseMoneyInput(line?.unit_price)
      return sum + computeLineCost(usage, unitPrice)
    }, 0)
  }, [watchedLines])

  const handleSubmit = (values: FormValues) => {
    setServerError(null)
    setSaved(false)

    const normalizedLines = values.lines
      .map((line) => {
        const name = normalizeText(line.name)
        const article = normalizeText(line.article)
        const composition = normalizeText(line.composition)
        const purchasePlace = normalizeText(line.purchase_place)
        const usage = parseUsageInput(line.usage)
        const unitPrice = parseMoneyInput(line.unit_price)

        const hasAny =
          Boolean(name) ||
          Boolean(article) ||
          Boolean(composition) ||
          Boolean(purchasePlace) ||
          usage !== null ||
          unitPrice !== null

        if (!hasAny) return null

        return {
          name,
          article,
          composition,
          purchase_place: purchasePlace,
          usage,
          unit_price: unitPrice
        }
      })
      .filter(Boolean) as TechCardLine[]

    if (!normalizedLines.length) {
      setServerError('Добавьте хотя бы одну строку')
      return
    }

    startTransition(async () => {
      const result = await upsertTechCard(model.id, {
        sketch_url: normalizeText(values.sketch_url),
        name: normalizeText(values.name),
        color: normalizeText(values.color),
        sizes: values.sizes,
        lines: normalizedLines
      })

      if (result?.error) {
        setServerError(result.error)
        return
      }

      if (result?.id) {
        setTechCardId(result.id)
      }
      setSaved(true)
    })
  }

  const handleDelete = () => {
    if (!techCardId) return
    if (!confirm('Удалить техкарту?')) return
    setServerError(null)
    setSaved(false)
    startDeleteTransition(async () => {
      const result = await deleteTechCard(model.id)
      if (result?.error) {
        setServerError(result.error)
        return
      }
      setTechCardId(null)
      form.reset({
        sketch_url: model.main_image_url ?? null,
        name: model.name,
        color: initialColor,
        sizes: sizeOptions,
        lines: Array.from({ length: 11 }, buildBlankLine)
      })
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Конфекционная карта</h2>
              <p className="text-sm text-slate-500">Итого себестоимость: {formatMoney(totalCost)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {techCardId ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="border border-rose-200 text-rose-600 hover:bg-rose-50"
                  onClick={handleDelete}
                  disabled={deletePending}
                >
                  Удалить
                </Button>
              ) : null}
              <Button type="submit" disabled={isPending}>
                Сохранить
              </Button>
            </div>
          </div>

          <Field label="Эскиз/фото">
            <StorageUploader
              bucket="product-images"
              onUploaded={(url) => form.setValue('sketch_url', url)}
            />
            {form.watch('sketch_url') ? (
              <img
                src={form.watch('sketch_url') as string}
                alt="tech sketch"
                className="mt-2 h-32 w-32 rounded-xl object-cover"
              />
            ) : null}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Наименование" error={form.formState.errors.name?.message}>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2"
                {...form.register('name')}
              />
            </Field>
            <Field label="Цвет">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2"
                {...form.register('color')}
              />
            </Field>
          </div>

          <Field label="Размеры">
            <div className="flex flex-wrap gap-2">
              {sizeOptions.map((size) => (
                <label
                  key={size}
                  className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700"
                >
                  <input type="checkbox" value={size} {...form.register('sizes')} />
                  {size}
                </label>
              ))}
            </div>
          </Field>

          {serverError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {serverError}
            </div>
          ) : null}
          {saved ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Сохранено
            </div>
          ) : null}
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Материалы и работы</h2>
          <Button type="button" variant="secondary" onClick={() => append(buildBlankLine())}>
            Добавить строку
          </Button>
        </div>

        <Table className="mt-4">
          <THead>
            <TR>
              <TH>№</TH>
              <TH>Наименование</TH>
              <TH>Артикул</TH>
              <TH>Состав</TH>
              <TH>Место закупки</TH>
              <TH>Расход (шт, м)</TH>
              <TH>Цена, руб</TH>
              <TH>Стоимость</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {fields.map((field, index) => {
              const line = watchedLines?.[index]
              const usage = parseUsageInput(line?.usage)
              const unitPrice = parseMoneyInput(line?.unit_price)
              const cost = computeLineCost(usage, unitPrice)

              return (
                <TR key={field.id}>
                  <TD className="whitespace-nowrap font-medium text-slate-900">{index + 1}</TD>
                  <TD>
                    <input
                      className="w-56 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                      {...form.register(`lines.${index}.name`)}
                    />
                  </TD>
                  <TD>
                    <input
                      className="w-44 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                      {...form.register(`lines.${index}.article`)}
                    />
                  </TD>
                  <TD>
                    <input
                      className="w-64 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                      {...form.register(`lines.${index}.composition`)}
                    />
                  </TD>
                  <TD>
                    <input
                      className="w-44 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                      {...form.register(`lines.${index}.purchase_place`)}
                    />
                  </TD>
                  <TD>
                    <input
                      className="w-28 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                      {...form.register(`lines.${index}.usage`)}
                    />
                  </TD>
                  <TD>
                    <input
                      className="w-28 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                      placeholder="0.00"
                      {...form.register(`lines.${index}.unit_price`)}
                    />
                  </TD>
                  <TD className="whitespace-nowrap text-slate-900">{formatMoney(cost)}</TD>
                  <TD>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3"
                      onClick={() => remove(index)}
                    >
                      Удалить
                    </Button>
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
