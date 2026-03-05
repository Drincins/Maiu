'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function ensureDefaults(userId?: string) {
  const supabase = await createClient()
  let resolvedUserId = userId

  if (!resolvedUserId) {
    const {
      data: { session }
    } = await supabase.auth.getSession()
    resolvedUserId = session?.user?.id
  }

  if (!resolvedUserId) return

  const { data: existingLocations } = await supabase
    .from('locations')
    .select('id, type')

  const existingTypes = new Set((existingLocations ?? []).map((loc) => loc.type))
  const defaultLocations = [
    { name: 'Склад Продажи', type: 'sales' },
    { name: 'Склад Реклама/PR', type: 'promo' },
    { name: 'Клиент', type: 'sold' },
    { name: 'Блогер', type: 'blogger' },
    { name: 'Списание', type: 'scrap' }
  ]
  const missingLocations = defaultLocations.filter(
    (location) => !existingTypes.has(location.type)
  )

  if (missingLocations.length) {
    await supabase.from('locations').insert(
      missingLocations.map((location) => ({
        user_id: resolvedUserId,
        ...location
      }))
    )
  }

  const { data: existingPayments } = await supabase
    .from('payment_sources')
    .select('id, name')

  const existingPaymentNames = new Set(
    (existingPayments ?? []).map((item) => item.name.trim().toLowerCase())
  )
  const defaultPayments = [
    { name: 'Наличные', type: 'cash' },
    { name: 'Карта физ', type: 'personal_card' },
    { name: 'Ип Малыш', type: 'other' },
    { name: 'Дымзавод', type: 'other' }
  ]
  const missingPayments = defaultPayments.filter(
    (item) => !existingPaymentNames.has(item.name.trim().toLowerCase())
  )

  if (missingPayments.length) {
    await supabase.from('payment_sources').insert(
      missingPayments.map((item) => ({
        user_id: resolvedUserId,
        ...item
      }))
    )
  }

  const { count: categoryCount } = await supabase
    .from('expense_categories')
    .select('*', { count: 'exact', head: true })

  if (!categoryCount) {
    await supabase.from('expense_categories').insert([
      { user_id: resolvedUserId, name: 'Закуп товара', kind: 'expense' },
      { user_id: resolvedUserId, name: 'Доставка', kind: 'expense' },
      { user_id: resolvedUserId, name: 'Упаковка', kind: 'expense' },
      { user_id: resolvedUserId, name: 'Реклама', kind: 'expense' },
      { user_id: resolvedUserId, name: 'Прочее', kind: 'expense' },
      { user_id: resolvedUserId, name: 'Продажи', kind: 'income' }
    ])
  }
}
