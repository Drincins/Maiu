'use server'

import { createClient } from '@/lib/supabase/server'
import { normalizeDashboardSettings, type DashboardSettings } from './settings'

export async function saveDashboardSettings(values: Partial<DashboardSettings>) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const normalized = normalizeDashboardSettings(values)

  const { error } = await supabase.from('dashboard_settings').upsert(
    {
      user_id: user.id,
      ...normalized
    },
    {
      onConflict: 'user_id'
    }
  )

  if (error) return { error: error.message }
  return { ok: true }
}
