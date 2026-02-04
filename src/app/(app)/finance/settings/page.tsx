import { createClient } from '@/lib/supabase/server'
import FinanceSettingsClient from './FinanceSettingsClient'
import { cleanupReferenceData } from '../actions'

export default async function FinanceSettingsPage() {
  const supabase = await createClient()
  await cleanupReferenceData()
  const [
    { data: paymentSources },
    { data: categories },
    { data: promoCodes },
    { data: locations }
  ] = await Promise.all([
    supabase.from('payment_sources').select('id, name').order('created_at'),
    supabase.from('expense_categories').select('id, name, kind').order('created_at'),
    supabase
      .from('promo_codes')
      .select('id, code, discount_type, discount_value, is_active')
      .order('created_at'),
    supabase.from('locations').select('id, name, type, is_active').order('created_at')
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Справочники</h1>
        <p className="text-sm text-slate-500">Минимальный CRUD для финансов</p>
      </div>
      <FinanceSettingsClient
        paymentSources={paymentSources ?? []}
        categories={categories ?? []}
        promoCodes={promoCodes ?? []}
        locations={locations ?? []}
      />
    </div>
  )
}

