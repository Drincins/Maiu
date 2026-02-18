import { createClient } from '@/lib/supabase/server'
import FinanceSettingsClient from './FinanceSettingsClient'
import { cleanupReferenceData } from '../actions'
import DashboardSettingsPanel from '../../dashboard/DashboardSettingsPanel'
import {
  DASHBOARD_SETTINGS_DEFAULTS,
  DASHBOARD_SETTINGS_SELECT,
  normalizeDashboardSettings
} from '../../dashboard/settings'

export default async function FinanceSettingsPage() {
  const supabase = await createClient()
  await cleanupReferenceData()

  const [
    { data: paymentSources },
    { data: categories },
    { data: promoCodes },
    { data: locations },
    { data: rawDashboardSettings, error: dashboardSettingsError }
  ] = await Promise.all([
    supabase.from('payment_sources').select('id, name').order('created_at'),
    supabase.from('expense_categories').select('id, name, kind').order('created_at'),
    supabase
      .from('promo_codes')
      .select('id, code, discount_type, discount_value, is_active')
      .order('created_at'),
    supabase.from('locations').select('id, name, type, is_active').order('created_at'),
    supabase
      .from('dashboard_settings')
      .select(DASHBOARD_SETTINGS_SELECT)
      .maybeSingle()
  ])

  const dashboardSettings = dashboardSettingsError
    ? DASHBOARD_SETTINGS_DEFAULTS
    : normalizeDashboardSettings(rawDashboardSettings)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Справочники</h1>
        <p className="text-sm text-slate-500">Настройка справочников и правил управленческой сводки</p>
      </div>

      <DashboardSettingsPanel initialSettings={dashboardSettings} />

      <FinanceSettingsClient
        paymentSources={paymentSources ?? []}
        categories={categories ?? []}
        promoCodes={promoCodes ?? []}
        locations={locations ?? []}
      />
    </div>
  )
}
