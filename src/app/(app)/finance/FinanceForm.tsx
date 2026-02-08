'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import StorageUploader from '@/components/StorageUploader'
import { moneyToInt } from '@/lib/money'
import { createFinanceTransaction } from './actions'

const schema = z.object({
  occurred_at: z.string().min(1),
  type: z.enum(['income', 'expense']),
  amount: z.string().min(1),
  payment_source_id: z.string().optional().nullable(),
  category_id: z.string().optional().nullable(),
  counterparty_name: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  attachment_url: z.string().optional().nullable()
})

type FormValues = z.infer<typeof schema>

type Option = { id: string; name: string }

type FinanceFormProps = {
  paymentSources: Option[]
  categories: { id: string; name: string; kind: string }[]
}

export default function FinanceForm({
  paymentSources,
  categories
}: FinanceFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      occurred_at: '',
      type: 'expense'
    }
  })

  useEffect(() => {
    const current = form.getValues('occurred_at')
    if (current) return
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    form.setValue('occurred_at', local.toISOString().slice(0, 16), {
      shouldDirty: false
    })
  }, [form])

  const selectedType = form.watch('type')
  const normalized = (value: string) => value.trim().toLowerCase()
  const allowedPaymentNames = ['Наличные', 'Карта физ', 'Ип Малыш', 'Дымзавод']
  const paymentSourceMap = new Map<string, Option>()
  paymentSources.forEach((item) => {
    const key = normalized(item.name)
    if (!paymentSourceMap.has(key)) {
      paymentSourceMap.set(key, item)
    }
  })
  const visiblePaymentSources = allowedPaymentNames
    .map((name) => paymentSourceMap.get(normalized(name)))
    .filter(Boolean) as Option[]

  const categoryMap = new Map<string, { id: string; name: string; kind: string }>()
  categories
    .filter((item) => item.kind === selectedType)
    .forEach((item) => {
      const key = `${normalized(item.name)}|${item.kind}`
      if (!categoryMap.has(key)) {
        categoryMap.set(key, item)
      }
    })
  const visibleCategories = Array.from(categoryMap.values())

  const handleSubmit = (values: FormValues) => {
    setServerError(null)

    startTransition(async () => {
      const result = await createFinanceTransaction({
        occurred_at: new Date(values.occurred_at).toISOString(),
        type: values.type,
        amount: moneyToInt(values.amount),
        payment_source_id: values.payment_source_id || null,
        category_id: values.category_id || null,
        counterparty_name: values.counterparty_name?.trim() || null,
        note: values.note || null,
        attachment_url: values.attachment_url || null
      })

      if (result?.error) {
        setServerError(result.error)
        return
      }

      window.location.href = '/finance'
    })
  }

  return (
    <Card>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Тип">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('type')}
            >
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
            </select>
          </Field>
          <Field label="Дата">
            <input
              type="datetime-local"
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('occurred_at')}
            />
          </Field>
          <Field label="Сумма (₽)">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('amount')}
            />
          </Field>
          <Field label="Источник оплаты">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('payment_source_id')}
            >
              <option value="">—</option>
              {visiblePaymentSources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Категория">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('category_id')}
            >
              <option value="">—</option>
              {visibleCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Контрагент">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('counterparty_name')}
              placeholder="Введите вручную"
            />
          </Field>
          <Field label="Комментарий">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...form.register('note')}
            />
          </Field>
        </div>
        <Field label="Вложение (не обязательно)">
          <StorageUploader
            bucket="finance-attachments"
            onUploaded={(url) => form.setValue('attachment_url', url)}
          />
        </Field>
        {serverError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {serverError}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            Сохранить
          </Button>
        </div>
      </form>
    </Card>
  )
}
