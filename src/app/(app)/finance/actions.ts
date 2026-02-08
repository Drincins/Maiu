'use server'

import { createClient } from '@/lib/supabase/server'

export async function createPaymentSource(values: {
  name: string
  legal_entity_id?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('payment_sources').insert({
    user_id: user.id,
    name: values.name,
    type: 'other',
    legal_entity_id: values.legal_entity_id ?? null
  })

  if (error) return { error: error.message }
  return { ok: true }
}

export async function deletePaymentSource(id: string) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('payment_sources')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function createLegalEntity(values: {
  name: string
  inn?: string | null
  note?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('legal_entities').insert({
    user_id: user.id,
    name: values.name,
    inn: values.inn ?? null,
    note: values.note ?? null
  })

  if (error) return { error: error.message }
  return { ok: true }
}

export async function createExpenseCategory(values: {
  name: string
  kind: string
}) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('expense_categories').insert({
    user_id: user.id,
    name: values.name,
    kind: values.kind
  })

  if (error) return { error: error.message }
  return { ok: true }
}

export async function deleteExpenseCategory(id: string) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('expense_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function createPromoCode(values: {
  code: string
  discount_type: string
  discount_value: number
  is_active?: boolean
}) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('promo_codes').insert({
    user_id: user.id,
    code: values.code,
    discount_type: values.discount_type,
    discount_value: values.discount_value,
    is_active: values.is_active ?? true
  })

  if (error) return { error: error.message }
  return { ok: true }
}

export async function deletePromoCode(id: string) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('promo_codes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function cleanupReferenceData() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const normalize = (value: string) => value.trim().toLowerCase()

  const deleteDuplicates = async <T extends { id: string }>(
    rows: T[],
    keyFn: (row: T) => string,
    table: string
  ) => {
    const seen = new Set<string>()
    const toDelete: string[] = []
    rows.forEach((row) => {
      const key = keyFn(row)
      if (seen.has(key)) {
        toDelete.push(row.id)
      } else {
        seen.add(key)
      }
    })
    if (toDelete.length) {
      const { error } = await supabase
        .from(table)
        .delete()
        .in('id', toDelete)
        .eq('user_id', user.id)
      if (error) return { error: error.message }
    }
    return { ok: true }
  }

  const { data: paymentSources } = await supabase
    .from('payment_sources')
    .select('id, name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const paymentResult = await deleteDuplicates(
    paymentSources ?? [],
    (row) => normalize(row.name),
    'payment_sources'
  )
  if (paymentResult?.error) return paymentResult

  const { data: categories } = await supabase
    .from('expense_categories')
    .select('id, name, kind, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const categoryResult = await deleteDuplicates(
    categories ?? [],
    (row) => `${row.kind}|${normalize(row.name)}`,
    'expense_categories'
  )
  if (categoryResult?.error) return categoryResult

  const { data: promoCodes } = await supabase
    .from('promo_codes')
    .select('id, code, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const promoResult = await deleteDuplicates(
    promoCodes ?? [],
    (row) => normalize(row.code),
    'promo_codes'
  )
  if (promoResult?.error) return promoResult

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const locationResult = await deleteDuplicates(
    locations ?? [],
    (row) => `${row.type}|${normalize(row.name)}`,
    'locations'
  )
  if (locationResult?.error) return locationResult

  return { ok: true }
}

export async function createLocation(values: { name: string; type: string }) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('locations').insert({
    user_id: user.id,
    name: values.name,
    type: values.type
  })

  if (error) return { error: error.message }
  return { ok: true }
}

export async function deleteLocation(id: string) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function createCounterparty(values: { name: string; type?: string }) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('counterparties').insert({
    user_id: user.id,
    name: values.name,
    type: values.type ?? 'other'
  })

  if (error) return { error: error.message }
  return { ok: true }
}

export async function deleteCounterparty(id: string) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('counterparties')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function createFinanceTransaction(values: {
  occurred_at: string
  type: string
  amount: number
  payment_source_id?: string | null
  legal_entity_id?: string | null
  category_id?: string | null
  counterparty_name?: string | null
  note?: string | null
  attachment_url?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  let counterpartyId: string | null = null
  if (values.counterparty_name && values.counterparty_name.trim().length > 0) {
    const name = values.counterparty_name.trim()
    const { data: existing } = await supabase
      .from('counterparties')
      .select('id')
      .eq('user_id', user.id)
      .ilike('name', name)
      .maybeSingle()

    if (existing?.id) {
      counterpartyId = existing.id
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('counterparties')
        .insert({
          user_id: user.id,
          name,
          type: 'other'
        })
        .select('id')
        .single()

      if (insertError) return { error: insertError.message }
      counterpartyId = inserted?.id ?? null
    }
  }

  const { error } = await supabase.from('finance_transactions').insert({
    user_id: user.id,
    occurred_at: values.occurred_at,
    type: values.type,
    amount: values.amount,
    payment_source_id: values.payment_source_id ?? null,
    legal_entity_id: values.legal_entity_id ?? null,
    category_id: values.category_id ?? null,
    counterparty_id: counterpartyId,
    note: values.note ?? null,
    attachment_url: values.attachment_url ?? null
  })

  if (error) return { error: error.message }
  return { ok: true }
}

