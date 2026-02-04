'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import {
  createExpenseCategory,
  createPaymentSource,
  createPromoCode,
  createLocation,
  deletePaymentSource,
  deleteExpenseCategory,
  deletePromoCode,
  deleteLocation
} from '../actions'

const paymentSchema = z.object({
  name: z.string().min(1)
})

const categorySchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['income', 'expense'])
})

const promoSchema = z.object({
  code: z.string().min(1),
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.coerce.number().int().min(0),
  is_active: z.boolean().optional()
})

const storageSchema = z.object({
  name: z.string().min(1)
})

const salesSchema = z.object({
  name: z.enum(['Клиент', 'Блогер', 'Брак/Списание'])
})

type FinanceSettingsClientProps = {
  paymentSources: { id: string; name: string }[]
  categories: { id: string; name: string; kind: string }[]
  promoCodes: {
    id: string
    code: string
    discount_type: string
    discount_value: number
    is_active: boolean
  }[]
  locations: { id: string; name: string; type: string; is_active?: boolean }[]
}

export default function FinanceSettingsClient({
  paymentSources,
  categories,
  promoCodes,
  locations
}: FinanceSettingsClientProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema)
  })

  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { kind: 'expense' }
  })

  const promoForm = useForm<z.infer<typeof promoSchema>>({
    resolver: zodResolver(promoSchema),
    defaultValues: { discount_type: 'percent', discount_value: 0, is_active: true }
  })

  const runAction = (action: () => Promise<{ error?: string }>) => {
    setServerError(null)
    startTransition(async () => {
      const result = await action()
      if (result?.error) {
        setServerError(result.error)
        return
      }
      window.location.reload()
    })
  }

  const submitPayment = (values: z.infer<typeof paymentSchema>) => {
    runAction(() => createPaymentSource(values))
  }

  const submitCategory = (values: z.infer<typeof categorySchema>) => {
    runAction(() => createExpenseCategory(values))
  }

  const submitPromo = (values: z.infer<typeof promoSchema>) => {
    runAction(() => createPromoCode(values))
  }

  const submitStorage = (values: z.infer<typeof storageSchema>) => {
    runAction(() => createLocation({ name: values.name, type: 'other' }))
  }

  const submitSales = (values: z.infer<typeof salesSchema>) => {
    const typeMap: Record<string, string> = {
      Клиент: 'sold',
      Блогер: 'blogger',
      'Брак/Списание': 'scrap'
    }
    const type = typeMap[values.name] ?? 'sold'
    runAction(() => createLocation({ name: values.name, type }))
  }

  const promoLabel = (promo: FinanceSettingsClientProps['promoCodes'][number]) => {
    const value =
      promo.discount_type === 'percent'
        ? `${promo.discount_value}%`
        : `${promo.discount_value} ₽`
    return `${promo.code} (${value})${promo.is_active ? '' : ' · не активен'}`
  }

  const salesLabel = (type: string) => {
    const map: Record<string, string> = {
      sold: 'Клиент',
      blogger: 'Блогер',
      scrap: 'Брак/Списание'
    }
    return map[type] ?? 'Клиент'
  }

  const storageLocations = locations.filter((item) =>
    ['sales', 'promo', 'other'].includes(item.type)
  )
  const salesLocations = locations.filter((item) =>
    ['sold', 'blogger', 'scrap'].includes(item.type)
  )

  const storageForm = useForm<z.infer<typeof storageSchema>>({
    resolver: zodResolver(storageSchema)
  })
  const salesForm = useForm<z.infer<typeof salesSchema>>({
    resolver: zodResolver(salesSchema),
    defaultValues: { name: 'Клиент' }
  })

  const TrashIcon = ({ className }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M7 6l1 14h8l1-14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )

  const IconButton = ({
    onClick
  }: {
    onClick: () => void
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
      title="Удалить"
      aria-label="Удалить"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Источники оплаты</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {paymentSources.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span>{item.name}</span>
              <IconButton onClick={() => runAction(() => deletePaymentSource(item.id))} />
            </li>
          ))}
        </ul>
        <form
          onSubmit={paymentForm.handleSubmit(submitPayment)}
          className="mt-4 grid gap-3"
        >
          <Field label="Название">
            <input className="rounded-xl border border-slate-200 px-3 py-2" {...paymentForm.register('name')} />
          </Field>
          <Button type="submit" disabled={isPending}>Добавить</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Категории</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {categories.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span>{item.name}</span>
              <IconButton onClick={() => runAction(() => deleteExpenseCategory(item.id))} />
            </li>
          ))}
        </ul>
        <form
          onSubmit={categoryForm.handleSubmit(submitCategory)}
          className="mt-4 grid gap-3"
        >
          <Field label="Название">
            <input className="rounded-xl border border-slate-200 px-3 py-2" {...categoryForm.register('name')} />
          </Field>
          <Field label="Тип">
            <select className="rounded-xl border border-slate-200 px-3 py-2" {...categoryForm.register('kind')}>
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </Field>
          <Button type="submit" disabled={isPending}>Добавить</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Промокоды</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {promoCodes.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span>{promoLabel(item)}</span>
              <IconButton onClick={() => runAction(() => deletePromoCode(item.id))} />
            </li>
          ))}
        </ul>
        <form
          onSubmit={promoForm.handleSubmit(submitPromo)}
          className="mt-4 grid gap-3"
        >
          <Field label="Код">
            <input className="rounded-xl border border-slate-200 px-3 py-2" {...promoForm.register('code')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Тип">
              <select className="rounded-xl border border-slate-200 px-3 py-2" {...promoForm.register('discount_type')}>
                <option value="percent">Процент</option>
                <option value="fixed">Фикс</option>
              </select>
            </Field>
            <Field label="Скидка">
              <input
                type="number"
                min={0}
                className="rounded-xl border border-slate-200 px-3 py-2"
                {...promoForm.register('discount_value')}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...promoForm.register('is_active')} />
            Активен
          </label>
          <Button type="submit" disabled={isPending}>Добавить</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Места хранения</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {storageLocations.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span>{item.name}</span>
              <IconButton onClick={() => runAction(() => deleteLocation(item.id))} />
            </li>
          ))}
        </ul>
        <form
          onSubmit={storageForm.handleSubmit(submitStorage)}
          className="mt-4 grid gap-3"
        >
          <Field label="Название">
            <input className="rounded-xl border border-slate-200 px-3 py-2" {...storageForm.register('name')} />
          </Field>
          <Button type="submit" disabled={isPending}>Добавить</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Получатель</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {salesLocations.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span>{salesLabel(item.type)}</span>
              <IconButton onClick={() => runAction(() => deleteLocation(item.id))} />
            </li>
          ))}
        </ul>
        <form
          onSubmit={salesForm.handleSubmit(submitSales)}
          className="mt-4 grid gap-3"
        >
          <Field label="Название">
            <select className="rounded-xl border border-slate-200 px-3 py-2" {...salesForm.register('name')}>
              <option value="Клиент">Клиент</option>
              <option value="Блогер">Блогер</option>
              <option value="Брак/Списание">Брак/Списание</option>
            </select>
          </Field>
          <Button type="submit" disabled={isPending}>Добавить</Button>
        </form>
      </Card>

      {serverError ? (
        <div className="col-span-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
          {serverError}
        </div>
      ) : null}
    </div>
  )
}
