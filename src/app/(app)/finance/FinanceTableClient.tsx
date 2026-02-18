'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/Table'
import { formatMoney, intToMoneyInput, moneyToInt } from '@/lib/money'
import { deleteFinanceTransaction, updateFinanceTransaction } from './actions'

type FinanceTransactionRow = {
  id: string
  occurred_at: string
  type: 'income' | 'expense'
  amount: number
  payment_source_id: string | null
  payment_source_name: string | null
  category_id: string | null
  category_name: string | null
  counterparty_name: string | null
  note: string | null
  attachment_url: string | null
}

type PaymentSourceOption = {
  id: string
  name: string
}

type CategoryOption = {
  id: string
  name: string
  kind: string
}

type FinanceTableClientProps = {
  initialTransactions: FinanceTransactionRow[]
  paymentSources: PaymentSourceOption[]
  categories: CategoryOption[]
}

type SortKey =
  | 'occurred_desc'
  | 'occurred_asc'
  | 'amount_desc'
  | 'amount_asc'
  | 'type_asc'
  | 'type_desc'

type EditDraft = {
  occurred_at: string
  type: 'income' | 'expense'
  amount: string
  payment_source_id: string
  category_id: string
  counterparty_name: string
  note: string
  attachment_url: string
}

const isMoneyInput = (value: string) => {
  const normalized = value.replace(',', '.').replace(/\s/g, '')
  if (!normalized) return false
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed)
}

const toLocalDatetimeInput = (value: string) => {
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const transactionTypeLabel = (type: 'income' | 'expense') =>
  type === 'income' ? 'Доход' : 'Расход'

const PencilIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
  </svg>
)

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
)

export default function FinanceTableClient({
  initialTransactions,
  paymentSources,
  categories
}: FinanceTableClientProps) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('occurred_desc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const visibleCategories = useMemo(() => {
    if (typeFilter === 'all') return categories
    return categories.filter((category) => category.kind === typeFilter)
  }, [categories, typeFilter])

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

    const filtered = transactions.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      if (paymentFilter && item.payment_source_id !== paymentFilter) return false
      if (categoryFilter && item.category_id !== categoryFilter) return false

      const occurredTs = new Date(item.occurred_at).getTime()
      if (fromTs !== null && occurredTs < fromTs) return false
      if (toTs !== null && occurredTs > toTs) return false

      if (!query) return true

      const haystack = [
        transactionTypeLabel(item.type),
        item.payment_source_name ?? '',
        item.category_name ?? '',
        item.counterparty_name ?? '',
        item.note ?? '',
        String(item.amount)
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.occurred_at).getTime()
      const dateB = new Date(b.occurred_at).getTime()

      switch (sortBy) {
        case 'occurred_asc':
          return dateA - dateB
        case 'amount_desc':
          return b.amount - a.amount
        case 'amount_asc':
          return a.amount - b.amount
        case 'type_asc':
          return transactionTypeLabel(a.type).localeCompare(transactionTypeLabel(b.type), 'ru')
        case 'type_desc':
          return transactionTypeLabel(b.type).localeCompare(transactionTypeLabel(a.type), 'ru')
        case 'occurred_desc':
        default:
          return dateB - dateA
      }
    })
  }, [
    transactions,
    searchQuery,
    typeFilter,
    paymentFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    sortBy
  ])

  const startEdit = (row: FinanceTransactionRow) => {
    setActionError(null)
    setEditingId(row.id)
    setEditDraft({
      occurred_at: toLocalDatetimeInput(row.occurred_at),
      type: row.type,
      amount: intToMoneyInput(row.amount),
      payment_source_id: row.payment_source_id ?? '',
      category_id: row.category_id ?? '',
      counterparty_name: row.counterparty_name ?? '',
      note: row.note ?? '',
      attachment_url: row.attachment_url ?? ''
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(null)
    setActionError(null)
  }

  const saveEdit = (transactionId: string) => {
    if (!editDraft) return
    if (!isMoneyInput(editDraft.amount)) {
      setActionError('Введите корректную сумму')
      return
    }
    if (!editDraft.occurred_at) {
      setActionError('Укажите дату')
      return
    }

    setActionError(null)
    startTransition(async () => {
      const payload = {
        occurred_at: new Date(editDraft.occurred_at).toISOString(),
        type: editDraft.type,
        amount: moneyToInt(editDraft.amount),
        payment_source_id: editDraft.payment_source_id || null,
        category_id: editDraft.category_id || null,
        counterparty_name: editDraft.counterparty_name.trim() || null,
        note: editDraft.note.trim() || null,
        attachment_url: editDraft.attachment_url.trim() || null
      }

      const result = await updateFinanceTransaction(transactionId, payload)
      if (result?.error) {
        setActionError(result.error)
        return
      }

      const paymentSourceName =
        paymentSources.find((item) => item.id === payload.payment_source_id)?.name ?? null
      const categoryName =
        categories.find((item) => item.id === payload.category_id)?.name ?? null

      setTransactions((prev) =>
        prev.map((item) =>
          item.id === transactionId
            ? {
                ...item,
                occurred_at: payload.occurred_at,
                type: payload.type as 'income' | 'expense',
                amount: payload.amount,
                payment_source_id: payload.payment_source_id,
                payment_source_name: paymentSourceName,
                category_id: payload.category_id,
                category_name: categoryName,
                counterparty_name: payload.counterparty_name,
                note: payload.note,
                attachment_url: payload.attachment_url
              }
            : item
        )
      )

      cancelEdit()
    })
  }

  const handleDelete = (transactionId: string) => {
    if (!window.confirm('Удалить транзакцию? Это действие нельзя отменить.')) return

    setActionError(null)
    startTransition(async () => {
      const result = await deleteFinanceTransaction(transactionId)
      if (result?.error) {
        setActionError(result.error)
        return
      }
      setTransactions((prev) => prev.filter((item) => item.id !== transactionId))
      if (editingId === transactionId) {
        cancelEdit()
      }
    })
  }

  const editCategoryOptions = useMemo(() => {
    if (!editDraft) return []
    return categories.filter((category) => category.kind === editDraft.type)
  }, [categories, editDraft])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <input
          className="rounded-xl border border-slate-200 px-3 py-2"
          placeholder="Поиск по типу, категории, контрагенту, комментарию"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as 'all' | 'income' | 'expense')}
        >
          <option value="all">Все типы</option>
          <option value="income">Доход</option>
          <option value="expense">Расход</option>
        </select>
        <select
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={paymentFilter}
          onChange={(event) => setPaymentFilter(event.target.value)}
        >
          <option value="">Все источники</option>
          {paymentSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">Все категории</option>
          {visibleCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <input
          type="date"
          className="rounded-xl border border-slate-200 px-3 py-2"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-3"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortKey)}
        >
          <option value="occurred_desc">Дата: новые сверху</option>
          <option value="occurred_asc">Дата: старые сверху</option>
          <option value="amount_desc">Сумма: по убыванию</option>
          <option value="amount_asc">Сумма: по возрастанию</option>
          <option value="type_asc">Тип: А-Я</option>
          <option value="type_desc">Тип: Я-А</option>
        </select>
      </div>

      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
          {actionError}
        </div>
      ) : null}

      <Table>
        <THead>
          <TR>
            <TH>Дата</TH>
            <TH>Тип</TH>
            <TH>Сумма</TH>
            <TH>Источник</TH>
            <TH>Категория</TH>
            <TH>Контрагент</TH>
            <TH>Комментарий</TH>
            <TH>Действия</TH>
          </TR>
        </THead>
        <TBody>
          {filteredTransactions.length ? (
            filteredTransactions.map((item) => (
              <Fragment key={item.id}>
                <TR>
                  <TD>{new Date(item.occurred_at).toLocaleString('ru-RU')}</TD>
                  <TD>
                    <Badge tone={item.type === 'income' ? 'success' : 'danger'}>
                      {transactionTypeLabel(item.type)}
                    </Badge>
                  </TD>
                  <TD className="font-semibold text-slate-900">{formatMoney(item.amount)}</TD>
                  <TD>{item.payment_source_name ?? '—'}</TD>
                  <TD>{item.category_name ?? '—'}</TD>
                  <TD>{item.counterparty_name ?? '—'}</TD>
                  <TD className="max-w-[260px] truncate">{item.note ?? '—'}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-200 hover:text-brand-700 disabled:opacity-60"
                        onClick={() => startEdit(item)}
                        disabled={isPending}
                        title="Редактировать"
                        aria-label="Редактировать"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-60"
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending}
                        title="Удалить"
                        aria-label="Удалить"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                      {item.attachment_url ? (
                        <a
                          href={item.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-100"
                        >
                          Вложение
                        </a>
                      ) : null}
                    </div>
                  </TD>
                </TR>
                {editingId === item.id && editDraft ? (
                  <TR>
                    <TD colSpan={8} className="bg-slate-50/70">
                      <div className="grid gap-3 md:grid-cols-3">
                        <Field label="Дата">
                          <input
                            type="datetime-local"
                            className="rounded-xl border border-slate-200 px-3 py-2"
                            value={editDraft.occurred_at}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      occurred_at: event.target.value
                                    }
                                  : prev
                              )
                            }
                          />
                        </Field>
                        <Field label="Тип">
                          <select
                            className="rounded-xl border border-slate-200 px-3 py-2"
                            value={editDraft.type}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      type: event.target.value as 'income' | 'expense',
                                      category_id: ''
                                    }
                                  : prev
                              )
                            }
                          >
                            <option value="income">Доход</option>
                            <option value="expense">Расход</option>
                          </select>
                        </Field>
                        <Field label="Сумма (₽)">
                          <input
                            className="rounded-xl border border-slate-200 px-3 py-2"
                            value={editDraft.amount}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      amount: event.target.value
                                    }
                                  : prev
                              )
                            }
                          />
                        </Field>
                        <Field label="Источник">
                          <select
                            className="rounded-xl border border-slate-200 px-3 py-2"
                            value={editDraft.payment_source_id}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      payment_source_id: event.target.value
                                    }
                                  : prev
                              )
                            }
                          >
                            <option value="">—</option>
                            {paymentSources.map((source) => (
                              <option key={source.id} value={source.id}>
                                {source.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Категория">
                          <select
                            className="rounded-xl border border-slate-200 px-3 py-2"
                            value={editDraft.category_id}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      category_id: event.target.value
                                    }
                                  : prev
                              )
                            }
                          >
                            <option value="">—</option>
                            {editCategoryOptions.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Контрагент">
                          <input
                            className="rounded-xl border border-slate-200 px-3 py-2"
                            value={editDraft.counterparty_name}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      counterparty_name: event.target.value
                                    }
                                  : prev
                              )
                            }
                          />
                        </Field>
                        <Field label="Комментарий">
                          <input
                            className="rounded-xl border border-slate-200 px-3 py-2"
                            value={editDraft.note}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      note: event.target.value
                                    }
                                  : prev
                              )
                            }
                          />
                        </Field>
                        <Field label="URL вложения">
                          <input
                            className="rounded-xl border border-slate-200 px-3 py-2"
                            value={editDraft.attachment_url}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      attachment_url: event.target.value
                                    }
                                  : prev
                              )
                            }
                          />
                        </Field>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={cancelEdit}
                          disabled={isPending}
                        >
                          Отмена
                        </Button>
                        <Button
                          type="button"
                          onClick={() => saveEdit(item.id)}
                          disabled={isPending}
                        >
                          Сохранить
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ) : null}
              </Fragment>
            ))
          ) : (
            <TR>
              <TD colSpan={8} className="text-center text-slate-500">
                Ничего не найдено по выбранным параметрам
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
    </div>
  )
}
