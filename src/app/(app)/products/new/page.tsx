'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Button } from '@/components/Button'
import StorageUploader from '@/components/StorageUploader'
import { createModel } from '../actions'
import { moneyToInt } from '@/lib/money'

const sizeOptions = ['XS', 'S', 'M'] as const

const isMoneyInput = (value: string) => {
  const normalized = value.replace(',', '.').replace(/\s/g, '')
  if (!normalized) return false
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed)
}

const schema = z.object({
  name: z.string().min(1, 'Введите название'),
  unit_price: z
    .string()
    .min(1, 'Введите стоимость')
    .refine(isMoneyInput, 'Введите корректную стоимость'),
  unit_cost: z
    .string()
    .min(1, 'Введите себестоимость')
    .refine(isMoneyInput, 'Введите корректную себестоимость'),
  color: z.string().min(1, 'Введите цвет'),
  sizes: z.array(z.enum(sizeOptions)).min(1, 'Выберите размеры'),
  main_image_url: z.string().optional()
})

type FormValues = z.infer<typeof schema>

export default function NewProductPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sizes: []
    }
  })

  const onSubmit = (values: FormValues) => {
    setServerError(null)
    startTransition(async () => {
      const result = await createModel({
        name: values.name,
        unit_price: moneyToInt(values.unit_price),
        unit_cost: moneyToInt(values.unit_cost),
        color: values.color,
        sizes: values.sizes,
        main_image_url: values.main_image_url || null
      })
      if (result?.error) {
        setServerError(result.error)
        return
      }
      if (result?.id) {
        router.push(`/products/${result.id}`)
      } else {
        router.push('/products')
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Новый товар</h1>
        <p className="text-sm text-slate-600">Быстро создаем карточку с размерами</p>
      </div>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <Field label="Название" error={errors.name?.message}>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              {...register('name')}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Стоимость (₽)" error={errors.unit_price?.message}>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2"
                {...register('unit_price')}
              />
            </Field>
            <Field label="Себестоимость (₽)" error={errors.unit_cost?.message}>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2"
                {...register('unit_cost')}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Цвет" error={errors.color?.message}>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2"
                {...register('color')}
              />
            </Field>
            <Field label="Размеры" error={errors.sizes?.message}>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((size) => (
                  <label
                    key={size}
                    className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700"
                  >
                    <input type="checkbox" value={size} {...register('sizes')} />
                    {size}
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <Field label="Фото (bucket product-images)">
            <StorageUploader
              bucket="product-images"
              onUploaded={(url) => setValue('main_image_url', url)}
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
    </div>
  )
}
