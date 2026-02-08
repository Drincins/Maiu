import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { formatMoney } from '@/lib/money'
import OperationRowActions from './OperationRowActions'

const typeLabels: Record<string, string> = {
  inbound: 'Приход',
  transfer: 'Перемещение',
  ship_blogger: 'Отправка блогеру',
  return_blogger: 'Возврат от блогера',
  sale: 'Продажа',
  sale_return: 'Возврат продажи',
  writeoff: 'Списание'
}

export default async function OperationsPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  const { data: operations, error: operationsError } = await supabase
    .from('operations')
    .select(
      'id, type, occurred_at, city, delivery_cost, note, from_location_id, to_location_id'
    )
    .order('occurred_at', { ascending: false })
    .limit(100)

  const locationIds = Array.from(
    new Set(
      (operations ?? [])
        .flatMap((op) => [op.from_location_id, op.to_location_id])
        .filter(Boolean)
    )
  ) as string[]

  const { data: locations, error: locationsError } = locationIds.length
    ? await supabase.from('locations').select('id, name').in('id', locationIds)
    : { data: [], error: null }

  const locationMap = new Map((locations ?? []).map((item) => [item.id, item.name]))

  const { data: issueLines, error: issueError } = await supabase
    .from('operation_lines')
    .select('operation_id')
    .ilike('line_note', '%MARKING_NOT_HANDLED%')

  const issueSet = new Set((issueLines ?? []).map((line) => line.operation_id))
  const isEmpty = (operations ?? []).length === 0

  const { count: operationsCount, error: operationsCountError } = isEmpty
    ? await supabase.from('operations').select('id', { count: 'exact', head: true })
    : { count: null, error: null }

  const { count: stockCount, error: stockCountError } = isEmpty
    ? await supabase.from('stock_movements').select('id', { count: 'exact', head: true })
    : { count: null, error: null }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Операции</h1>
          <p className="text-sm text-slate-500">Журнал складских операций</p>
        </div>
        <Link href="/operations/new">
          <Button>Новая операция</Button>
        </Link>
      </div>

      <Card>
        {isEmpty ? (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div>Операций не найдено.</div>
            <div>
              Пользователь: {user?.id ?? 'нет сессии'}
            </div>
            <div>
              Кол-во операций: {operationsCount ?? '—'}
              {operationsCountError ? ` (ошибка: ${operationsCountError.message})` : ''}
            </div>
            <div>
              Кол-во движений склада: {stockCount ?? '—'}
              {stockCountError ? ` (ошибка: ${stockCountError.message})` : ''}
            </div>
          </div>
        ) : null}
        {operationsError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            Ошибка загрузки операций: {operationsError.message}
          </div>
        ) : null}
        {locationsError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            Ошибка загрузки локаций: {locationsError.message}
          </div>
        ) : null}
        {issueError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            Ошибка загрузки пометок: {issueError.message}
          </div>
        ) : null}
        <Table>
          <THead>
            <TR>
              <TH>Дата</TH>
              <TH>Тип</TH>
              <TH>Город</TH>
              <TH>Доставка</TH>
              <TH>Откуда &rarr; Куда</TH>
              <TH>Проблемы</TH>
              <TH>Комментарий</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {(operations ?? []).map((op) => (
              <TR key={op.id}>
                <TD>{new Date(op.occurred_at).toLocaleString('ru-RU')}</TD>
                <TD>
                  <Badge tone="info">{typeLabels[op.type] ?? op.type}</Badge>
                </TD>
                <TD>{(op as any).city ?? '—'}</TD>
                <TD>{op.delivery_cost ? formatMoney(op.delivery_cost) : '—'}</TD>
                <TD>
                  {op.from_location_id ? locationMap.get(op.from_location_id) ?? '—' : '—'} &rarr;{' '}
                  {op.to_location_id ? locationMap.get(op.to_location_id) ?? '—' : '—'}
                </TD>
                <TD>
                  {issueSet.has(op.id) ? (
                    <Badge tone="warning">Маркировка</Badge>
                  ) : (
                    '—'
                  )}
                </TD>
                <TD className="max-w-[240px] truncate">{op.note ?? '—'}</TD>
                <TD>
                  <OperationRowActions operationId={op.id} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  )
}


