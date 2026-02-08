import { createClient } from '@/lib/supabase/server'
import FinanceForm from '../FinanceForm'

export default async function NewFinancePage() {
  const supabase = await createClient()
  const [{ data: paymentSources }, { data: categories }] = await Promise.all([
    supabase.from('payment_sources').select('id, name').order('created_at'),
    supabase
      .from('expense_categories')
      .select('id, name, kind')
      .order('created_at'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Новая транзакция</h1>
        <p className="text-sm text-slate-500">Фиксируем доходы и расходы</p>
      </div>
      <FinanceForm
        paymentSources={paymentSources ?? []}
        categories={categories ?? []}
      />
    </div>
  )
}

