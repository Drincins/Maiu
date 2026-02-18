import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import FinanceTableClient from './FinanceTableClient'

type NamedRelation = { id?: string; name?: string | null } | Array<{ id?: string; name?: string | null }> | null

const firstRelation = (relation: NamedRelation) =>
  Array.isArray(relation) ? relation[0] ?? null : relation

export default async function FinancePage() {
  const supabase = await createClient()

  const [{ data: transactions }, { data: paymentSources }, { data: categories }] =
    await Promise.all([
      supabase
        .from('finance_transactions')
        .select(
          `id, occurred_at, type, amount, note, attachment_url, payment_source_id, category_id,
           payment_source:payment_source_id(id, name),
           category:category_id(id, name),
           counterparty:counterparty_id(name)`
        )
        .order('occurred_at', { ascending: false })
        .limit(1000),
      supabase.from('payment_sources').select('id, name').order('name', { ascending: true }),
      supabase
        .from('expense_categories')
        .select('id, name, kind')
        .order('name', { ascending: true })
    ])

  const normalizedTransactions = (transactions ?? []).map((item) => {
    const paymentSource = firstRelation(item.payment_source as NamedRelation)
    const category = firstRelation(item.category as NamedRelation)
    const counterparty = firstRelation(item.counterparty as NamedRelation)

    return {
      id: item.id,
      occurred_at: item.occurred_at,
      type: item.type as 'income' | 'expense',
      amount: item.amount,
      payment_source_id: item.payment_source_id ?? null,
      payment_source_name: paymentSource?.name ?? null,
      category_id: item.category_id ?? null,
      category_name: category?.name ?? null,
      counterparty_name: counterparty?.name ?? null,
      note: item.note ?? null,
      attachment_url: item.attachment_url ?? null
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Финансы</h1>
          <p className="text-sm text-slate-500">Доходы и расходы</p>
        </div>
        <Link href="/finance/new">
          <Button>Новая транзакция</Button>
        </Link>
      </div>

      <Card>
        <FinanceTableClient
          initialTransactions={normalizedTransactions}
          paymentSources={
            (paymentSources ?? []).map((source) => ({
              id: source.id,
              name: source.name
            }))
          }
          categories={
            (categories ?? []).map((category) => ({
              id: category.id,
              name: category.name,
              kind: category.kind
            }))
          }
        />
      </Card>
    </div>
  )
}
