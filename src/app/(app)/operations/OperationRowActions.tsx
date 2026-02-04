'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteOperation } from './actions'

type OperationRowActionsProps = {
  operationId: string
}

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

export default function OperationRowActions({
  operationId
}: OperationRowActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!window.confirm('Удалить операцию? Это действие нельзя отменить.')) {
      return
    }
    startTransition(async () => {
      const result = await deleteOperation(operationId)
      if (!result?.error) {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/operations/${operationId}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-200 hover:text-brand-700"
        title="Редактировать"
        aria-label="Редактировать"
      >
        <PencilIcon className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-60"
        title="Удалить"
        aria-label="Удалить"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
