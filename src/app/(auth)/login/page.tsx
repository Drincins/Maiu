'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn, signUp } from './actions'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Logo } from '@/components/Logo'

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(6, 'Минимум 6 символов')
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  const onSubmit = (values: FormValues) => {
    setServerError(null)
    startTransition(async () => {
      const result =
        mode === 'signin' ? await signIn(values) : await signUp(values)
      if (result?.error) {
        setServerError(result.error)
      }
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex flex-col gap-2">
          <Logo size="md" subtitle="Inventory" />
          <p className="text-sm text-slate-600">
            Войдите или создайте учетную запись
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Email" error={errors.email?.message}>
            <input
              type="email"
              className="rounded-xl border border-slate-200 px-3 py-2"
              placeholder="mail@example.com"
              {...register('email')}
            />
          </Field>
          <Field label="Пароль" error={errors.password?.message}>
            <input
              type="password"
              className="rounded-xl border border-slate-200 px-3 py-2"
              placeholder="••••••••"
              {...register('password')}
            />
          </Field>
          {serverError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {serverError}
            </div>
          ) : null}
          <Button type="submit" disabled={isPending} className="w-full">
            {mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
          </Button>
        </form>
        <div className="mt-4 text-center text-xs text-slate-500">
          {mode === 'signin' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
          <button
            type="button"
            className="font-semibold text-brand-700"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </div>
      </Card>
    </main>
  )
}
