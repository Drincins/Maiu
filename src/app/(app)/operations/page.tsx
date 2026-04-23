import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import OperationsTableClient from './OperationsTableClient'

type OperationLineRow = {
  operation_id: string | null
  qty: number
  unit_price_snapshot: number | null
  unit_cost_snapshot: number | null
  product_variants?:
    | {
        sku: string | null
        size: string | null
        color: string | null
        product_models?:
          | {
              name: string | null
            }
          | Array<{
              name: string | null
            }>
          | null
      }
    | Array<{
        sku: string | null
        size: string | null
        color: string | null
        product_models?:
          | {
              name: string | null
            }
          | Array<{
              name: string | null
            }>
          | null
      }>
    | null
}

export default async function OperationsPage() {
  const supabase = await createClient()

  const { data: operations, error: operationsError } = await supabase
    .from('operations')
    .select(`
      id,
      type,
      occurred_at,
      city,
      delivery_cost,
      tracking_number,
      note,
      from_location_id,
      to_location_id,
      promo_code_id
    `)
    .order('occurred_at', { ascending: false })
    .limit(500)

  const operationRows = operations ?? []
  const operationIds = operationRows.map((operation) => operation.id)

  const locationIds = Array.from(
    new Set(
      operationRows
        .flatMap((operation) => [operation.from_location_id, operation.to_location_id])
        .filter(Boolean)
    )
  ) as string[]

  const [
    { data: locations, error: locationsError },
    { data: operationLines, error: linesError },
    { data: issueLines, error: issueError }
  ] = await Promise.all([
    locationIds.length
      ? supabase.from('locations').select('id, name').in('id', locationIds)
      : Promise.resolve({ data: [], error: null }),
    operationIds.length
      ? supabase
          .from('operation_lines')
          .select(
            `
            operation_id,
            qty,
            unit_price_snapshot,
            unit_cost_snapshot,
            product_variants (
              sku,
              size,
              color,
              product_models (
                name
              )
            )
          `
        )
          .in('operation_id', operationIds)
      : Promise.resolve({ data: [], error: null }),
    operationIds.length
      ? supabase
          .from('operation_lines')
          .select('operation_id')
          .in('operation_id', operationIds)
          .ilike('line_note', '%MARKING_NOT_HANDLED%')
      : Promise.resolve({ data: [], error: null })
  ])

  const operationLineRows = (operationLines ?? []) as OperationLineRow[]
  const linesByOperationId = new Map<string, OperationLineRow[]>()
  operationLineRows.forEach((line) => {
    if (!line.operation_id) return
    const existing = linesByOperationId.get(line.operation_id) ?? []
    existing.push(line)
    linesByOperationId.set(line.operation_id, existing)
  })

  const operationsWithLines = operationRows.map((operation) => ({
    ...operation,
    operation_lines: (linesByOperationId.get(operation.id) ?? []).map(
      ({ operation_id: _operationId, ...line }) => line
    )
  }))

  const isEmpty = !operationsError && operationRows.length === 0

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

        {linesError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            Ошибка загрузки строк операций: {linesError.message}
          </div>
        ) : null}

        {issueError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            Ошибка загрузки пометок: {issueError.message}
          </div>
        ) : null}

        <OperationsTableClient
          operations={operationsWithLines as Array<{
            id: string
            type: string
            occurred_at: string
            city: string | null
            delivery_cost: number | null
            tracking_number: string | null
            note: string | null
            from_location_id: string | null
            to_location_id: string | null
            promo_code_id: string | null
            operation_lines?: Array<{
              qty: number
              unit_price_snapshot: number | null
              unit_cost_snapshot: number | null
              product_variants?:
                | {
                    sku: string | null
                    size: string | null
                    color: string | null
                    product_models?:
                      | {
                          name: string | null
                        }
                      | Array<{
                          name: string | null
                        }>
                      | null
                  }
                | Array<{
                    sku: string | null
                    size: string | null
                    color: string | null
                    product_models?:
                      | {
                          name: string | null
                        }
                      | Array<{
                          name: string | null
                        }>
                      | null
                  }>
                | null
            }>
          }>}
          locations={(locations ?? []) as Array<{ id: string; name: string }>}
          issueOperationIds={(issueLines ?? []).map((line) => line.operation_id)}
        />
      </Card>
    </div>
  )
}
