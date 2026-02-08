import { createClient } from '@/lib/supabase/server'
import OperationForm, { type OperationFormValues } from '../OperationForm'
import { intToMoneyInput } from '@/lib/money'

type OperationEditPageProps = {
  params: Promise<{ id: string }>
}

const MARKING_NOTE = '[MARKING_NOT_HANDLED]'

export default async function OperationEditPage({ params }: OperationEditPageProps) {
  const supabase = await createClient()
  const { id: operationId } = await params

  const [
    { data: variants },
    { data: locations },
    { data: promoCodes },
    { data: operation, error: operationError },
    { data: lines, error: linesError },
    { data: markCodes, error: markCodesError }
  ] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, sku, size, color, unit_price, unit_cost, is_marked')
      .order('created_at', { ascending: false }),
    supabase.from('locations').select('id, name, type').order('created_at'),
    supabase.from('promo_codes').select('id, code').order('created_at'),
    supabase
      .from('operations')
      .select(
        'id, type, occurred_at, from_location_id, to_location_id, promo_code_id, sale_channel, city, delivery_cost, delivery_service, tracking_number, note'
      )
      .eq('id', operationId)
      .single(),
    supabase
      .from('operation_lines')
      .select('id, variant_id, qty, unit_price_snapshot, line_note')
      .eq('operation_id', operationId)
      .order('created_at'),
    supabase
      .from('mark_codes')
      .select('variant_id, code')
      .eq('last_operation_id', operationId)
  ])

  if (!operation || operationError) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Операция не найдена</h1>
          <p className="text-sm text-slate-500">
            Проверьте, что ссылка корректна и у вас есть доступ к этой операции.
          </p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div>Operation ID: {operationId}</div>
          {operationError ? <div>Ошибка: {operationError.message}</div> : null}
          {!operationError ? <div>Операция не найдена.</div> : null}
        </div>
      </div>
    )
  }

  const codesByVariant = new Map<string, string[]>()
  ;(markCodes ?? []).forEach((row) => {
    if (!row?.variant_id) return
    const existing = codesByVariant.get(row.variant_id) ?? []
    existing.push(row.code)
    codesByVariant.set(row.variant_id, existing)
  })

  const initialValues: OperationFormValues = {
    type: operation.type,
    occurred_at: operation.occurred_at
      ? new Date(operation.occurred_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    from_location_id: operation.from_location_id ?? '',
    to_location_id: operation.to_location_id ?? '',
    promo_code_id: operation.promo_code_id ?? '',
    sale_channel: operation.sale_channel ?? '',
    city: operation.city ?? '',
    delivery_cost:
      operation.delivery_cost !== null && operation.delivery_cost !== undefined
        ? intToMoneyInput(operation.delivery_cost)
        : '',
    delivery_service: operation.delivery_service ?? '',
    tracking_number: operation.tracking_number ?? '',
    note: operation.note ?? '',
    lines:
      (lines ?? []).map((line) => {
        const note = line.line_note ?? ''
        const markingNotHandled = note.includes(MARKING_NOTE)
        const cleanedNote = markingNotHandled
          ? note.replace(MARKING_NOTE, '').trim()
          : note
        return {
          variant_id: line.variant_id,
          qty: Number(line.qty ?? 0),
          unit_price_snapshot:
            line.unit_price_snapshot !== null && line.unit_price_snapshot !== undefined
              ? intToMoneyInput(line.unit_price_snapshot)
              : '',
          line_note: cleanedNote,
          mark_codes: codesByVariant.get(line.variant_id) ?? [],
          marking_not_handled: markingNotHandled
        }
      }) ?? []
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Редактировать операцию</h1>
        <p className="text-sm text-slate-500">
          Изменения пересчитают движения склада
        </p>
      </div>
      <OperationForm
        variants={variants ?? []}
        locations={locations ?? []}
        promoCodes={promoCodes ?? []}
        operationId={operationId}
        initialValues={initialValues}
        submitLabel="Сохранить изменения"
      />
    </div>
  )
}
