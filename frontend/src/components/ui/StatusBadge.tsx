import { clsx } from 'clsx'
import type { ConversationStatus } from '../../types'

const labels: Record<ConversationStatus, string> = {
  open:        'مفتوحة',
  pending:     'بانتظار العميل',
  needs_human: 'تحتاج تدخل',
  closed:      'مغلقة',
}

const styles: Record<ConversationStatus, string> = {
  open:        'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending:     'bg-amber-50  text-amber-700  border border-amber-200',
  needs_human: 'bg-orange-50 text-orange-700 border border-orange-200',
  closed:      'bg-ink-100   text-ink-500    border border-ink-300',
}

export function StatusBadge({ status, className }: { status: ConversationStatus; className?: string }) {
  return (
    <span className={clsx('status-badge', styles[status], className)}>
      {labels[status]}
    </span>
  )
}
