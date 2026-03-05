'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { saveDashboardSettings } from './actions'
import {
  DASHBOARD_BOOLEAN_SETTING_KEYS,
  type DashboardBooleanSettingKey,
  type DashboardSettings
} from './settings'

type DashboardSettingsPanelProps = {
  initialSettings: DashboardSettings
}

const settingLabels: Record<DashboardBooleanSettingKey, { label: string; hint: string }> = {
  include_finance_income: {
    label: 'Доходы из раздела Финансы',
    hint: 'Транзакции типа доход'
  },
  include_finance_expense: {
    label: 'Расходы из раздела Финансы',
    hint: 'Транзакции типа расход'
  },
  include_sales_revenue: {
    label: 'Выручка с продаж',
    hint: 'Сумма по операциям продажи'
  },
  include_sale_returns: {
    label: 'Возвраты клиентам',
    hint: 'Операции возврата продажи как минус'
  },
  include_sales_delivery: {
    label: 'Доставка по продажам',
    hint: 'Расходы на доставку продаж и возвратов'
  },
  include_sales_discounts: {
    label: 'Потери на скидках',
    hint: 'Скидки и промокоды'
  },
  include_sales_cogs: {
    label: 'Себестоимость продаж в минусах',
    hint: 'Включайте только если хотите считать COGS как расход в управленческом итоге'
  },
  include_sales_return_cost_recovery: {
    label: 'Возврат себестоимости (продажи)',
    hint: 'Компенсация COGS по возвратам продаж (работает вместе с пунктом выше)'
  },
  include_blogger_ship_cost: {
    label: 'Себестоимость отправок блогерам',
    hint: 'Учитывать ship_blogger как расход (потеря себестоимости)'
  },
  include_blogger_delivery: {
    label: 'Доставка блогерам',
    hint: 'Доставка по ship_blogger и return_blogger'
  },
  include_blogger_return_recovery: {
    label: 'Возврат от блогеров (себестоимость)',
    hint: 'Что вернулось от блогеров'
  }
}

const incomeKeys: DashboardBooleanSettingKey[] = [
  'include_finance_income',
  'include_sales_revenue',
  'include_sales_return_cost_recovery',
  'include_blogger_return_recovery'
]

const expenseKeys: DashboardBooleanSettingKey[] = DASHBOARD_BOOLEAN_SETTING_KEYS.filter(
  (key) => !incomeKeys.includes(key)
)

export default function DashboardSettingsPanel({ initialSettings }: DashboardSettingsPanelProps) {
  const [settings, setSettings] = useState(() => ({
    ...initialSettings,
    include_sales_return_cost_recovery:
      initialSettings.include_sales_cogs && initialSettings.include_sales_return_cost_recovery
  }))
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggleSetting = (key: DashboardBooleanSettingKey) => {
    setSettings((prev) => {
      if (key === 'include_sales_return_cost_recovery' && !prev.include_sales_cogs) {
        return prev
      }

      if (key === 'include_sales_cogs') {
        const nextIncludeSalesCogs = !prev.include_sales_cogs
        return {
          ...prev,
          include_sales_cogs: nextIncludeSalesCogs,
          include_sales_return_cost_recovery: nextIncludeSalesCogs
            ? prev.include_sales_return_cost_recovery
            : false
        }
      }

      return {
        ...prev,
        [key]: !prev[key]
      }
    })
  }

  const save = () => {
    setServerError(null)
    startTransition(async () => {
      const result = await saveDashboardSettings(settings)
      if (result?.error) {
        setServerError(result.error)
        return
      }
      window.location.reload()
    })
  }

  const SettingItem = ({ settingKey }: { settingKey: DashboardBooleanSettingKey }) => {
    const isSalesReturnRecoveryDisabled =
      settingKey === 'include_sales_return_cost_recovery' && !settings.include_sales_cogs

    return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-slate-200/80 px-3 py-2 ${
        isSalesReturnRecoveryDisabled ? 'bg-slate-50 text-slate-400' : 'bg-white/70'
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-brand-700"
        checked={settings[settingKey]}
        disabled={isSalesReturnRecoveryDisabled}
        onChange={() => toggleSetting(settingKey)}
      />
      <span className="text-sm">
        <span className={`block font-medium ${isSalesReturnRecoveryDisabled ? 'text-slate-500' : 'text-slate-800'}`}>
          {settingLabels[settingKey].label}
        </span>
        <span className="block text-xs text-slate-500">{settingLabels[settingKey].hint}</span>
      </span>
    </label>
    )
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Настройки управленческой сводки</h2>
          <p className="text-sm text-slate-500">
            Определите, что считать доходом и расходом в отчете.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={settings.sales_revenue_source}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                sales_revenue_source:
                  event.target.value === 'finance' ? 'finance' : 'operations'
              }))
            }
          >
            <option value="operations">Продажи считаем из Операций</option>
            <option value="finance">Продажи считаем из Финансов</option>
          </select>
          <Button type="button" variant="secondary" onClick={save} disabled={isPending}>
            Сохранить
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Что считаем доходом
          </div>
          <div className="mt-2 grid gap-2">
            {incomeKeys.map((key) => (
              <SettingItem key={key} settingKey={key} />
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
            Что считаем расходом
          </div>
          <div className="mt-2 grid gap-2">
            {expenseKeys.map((key) => (
              <SettingItem key={key} settingKey={key} />
            ))}
          </div>
        </div>
      </div>

      {settings.sales_revenue_source === 'finance' ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Режим "Продажи из Финансов": выручка по операциям продажи не добавляется отдельно, чтобы не задваивать отчет.
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
        Рекомендуемый режим: себестоимость продаж не включать в «Минусы», а учитывать отдельно как аналитический показатель.
      </div>

      {serverError ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
          {serverError}
        </div>
      ) : null}
    </Card>
  )
}
