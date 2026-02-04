import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { formatMoney } from '@/lib/money'

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: transactions } = await supabase
    .from('finance_transactions')
    .select(
      `id, occurred_at, type, amount, note,
       payment_source:payment_source_id(name),
       category:category_id(name)`
    )
    .order('occurred_at', { ascending: false })
    .limit(100)

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
        <Table>
          <THead>
            <TR>
              <TH>Дата</TH>
              <TH>Тип</TH>
              <TH>Сумма</TH>
              <TH>Источник</TH>
              <TH>Категория</TH>
              <TH>Комментарий</TH>
            </TR>
          </THead>
          <TBody>
            {(transactions ?? []).map((item) => (
              <TR key={item.id}>
                <TD>{new Date(item.occurred_at).toLocaleString('ru-RU')}</TD>
                <TD>
                  <Badge tone={item.type === 'income' ? 'success' : 'danger'}>
                    {item.type === 'income' ? 'Доход' : 'Расход'}
                  </Badge>
                </TD>
                <TD className="font-semibold text-slate-900">{formatMoney(item.amount)}</TD>
                <TD>{(item.payment_source as any)?.name ?? '—'}</TD>
                <TD>{(item.category as any)?.name ?? '—'}</TD>
                <TD className="max-w-[240px] truncate">{item.note ?? '—'}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  )
}

