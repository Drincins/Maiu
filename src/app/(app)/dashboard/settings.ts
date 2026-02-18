export type SalesRevenueSource = 'operations' | 'finance'

export type DashboardSettings = {
  sales_revenue_source: SalesRevenueSource
  include_finance_income: boolean
  include_finance_expense: boolean
  include_sales_revenue: boolean
  include_sale_returns: boolean
  include_sales_delivery: boolean
  include_sales_discounts: boolean
  include_sales_cogs: boolean
  include_sales_return_cost_recovery: boolean
  include_blogger_ship_cost: boolean
  include_blogger_delivery: boolean
  include_blogger_return_recovery: boolean
}

export const DASHBOARD_BOOLEAN_SETTING_KEYS = [
  'include_finance_income',
  'include_finance_expense',
  'include_sales_revenue',
  'include_sale_returns',
  'include_sales_delivery',
  'include_sales_discounts',
  'include_sales_cogs',
  'include_sales_return_cost_recovery',
  'include_blogger_ship_cost',
  'include_blogger_delivery',
  'include_blogger_return_recovery'
] as const

export type DashboardBooleanSettingKey = (typeof DASHBOARD_BOOLEAN_SETTING_KEYS)[number]

export const DASHBOARD_SETTINGS_DEFAULTS: DashboardSettings = {
  sales_revenue_source: 'operations',
  include_finance_income: true,
  include_finance_expense: true,
  include_sales_revenue: true,
  include_sale_returns: true,
  include_sales_delivery: true,
  include_sales_discounts: true,
  include_sales_cogs: true,
  include_sales_return_cost_recovery: true,
  include_blogger_ship_cost: true,
  include_blogger_delivery: true,
  include_blogger_return_recovery: true
}

export const DASHBOARD_SETTINGS_SELECT = [
  'sales_revenue_source',
  ...DASHBOARD_BOOLEAN_SETTING_KEYS
].join(', ')

const normalizeSalesRevenueSource = (value: unknown): SalesRevenueSource => {
  return value === 'finance' ? 'finance' : 'operations'
}

const normalizeBoolean = (value: unknown, fallback: boolean) => {
  return typeof value === 'boolean' ? value : fallback
}

type DashboardSettingsLike = Partial<Record<keyof DashboardSettings, unknown>>

export function normalizeDashboardSettings(input?: unknown): DashboardSettings {
  const value: DashboardSettingsLike =
    input && typeof input === 'object' ? (input as DashboardSettingsLike) : {}

  return {
    sales_revenue_source: normalizeSalesRevenueSource(value.sales_revenue_source),
    include_finance_income: normalizeBoolean(
      value.include_finance_income,
      DASHBOARD_SETTINGS_DEFAULTS.include_finance_income
    ),
    include_finance_expense: normalizeBoolean(
      value.include_finance_expense,
      DASHBOARD_SETTINGS_DEFAULTS.include_finance_expense
    ),
    include_sales_revenue: normalizeBoolean(
      value.include_sales_revenue,
      DASHBOARD_SETTINGS_DEFAULTS.include_sales_revenue
    ),
    include_sale_returns: normalizeBoolean(
      value.include_sale_returns,
      DASHBOARD_SETTINGS_DEFAULTS.include_sale_returns
    ),
    include_sales_delivery: normalizeBoolean(
      value.include_sales_delivery,
      DASHBOARD_SETTINGS_DEFAULTS.include_sales_delivery
    ),
    include_sales_discounts: normalizeBoolean(
      value.include_sales_discounts,
      DASHBOARD_SETTINGS_DEFAULTS.include_sales_discounts
    ),
    include_sales_cogs: normalizeBoolean(
      value.include_sales_cogs,
      DASHBOARD_SETTINGS_DEFAULTS.include_sales_cogs
    ),
    include_sales_return_cost_recovery: normalizeBoolean(
      value.include_sales_return_cost_recovery,
      DASHBOARD_SETTINGS_DEFAULTS.include_sales_return_cost_recovery
    ),
    include_blogger_ship_cost: normalizeBoolean(
      value.include_blogger_ship_cost,
      DASHBOARD_SETTINGS_DEFAULTS.include_blogger_ship_cost
    ),
    include_blogger_delivery: normalizeBoolean(
      value.include_blogger_delivery,
      DASHBOARD_SETTINGS_DEFAULTS.include_blogger_delivery
    ),
    include_blogger_return_recovery: normalizeBoolean(
      value.include_blogger_return_recovery,
      DASHBOARD_SETTINGS_DEFAULTS.include_blogger_return_recovery
    )
  }
}
