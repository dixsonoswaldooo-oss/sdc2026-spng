import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { getReceivables, getSummary } from '@/api/client';
import type { Receivable } from '@/api/types';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Money } from '@/components/Money';
import { Skeleton } from '@/components/Skeleton';
import { TableHeader } from '@/components/TableHeader';
import { TABLE, TD, TR } from '@/components/tableStyles';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/useApi';

type Filter = 'ALL' | 'OVERDUE' | 'BEFORE_PAYDAY';
type Sort = 'DAYS_OVERDUE' | 'AMOUNT';

const FILTERS: [Filter, string][] = [['ALL', 'All'], ['OVERDUE', 'Overdue'], ['BEFORE_PAYDAY', 'Due before payday']];
const REMINDER: Record<Receivable['reminderStatus'], string> = { NONE: 'Not sent', DRAFTED: 'Drafted', SENT: 'Sent', REPLIED: 'Replied' };
const SEGMENT = 'rounded px-3 py-1 text-xs font-medium';

export function ReceivablesPage() {
  const receivables = useApi(getReceivables);
  const summary = useApi(getSummary);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<Sort>('DAYS_OVERDUE');

  if (!receivables.data || !summary.data) {
    const error = receivables.error ?? summary.error;
    return error ? <ErrorState message={error.message} onRetry={() => { receivables.retry(); summary.retry(); }} /> : <Skeleton className="h-72" />;
  }

  const payday = summary.data.payday;
  const rows = receivables.data
    .filter((r) => filter === 'ALL' || (filter === 'OVERDUE' ? r.daysOverdue > 0 : r.daysOverdue === 0 && r.dueDate <= payday))
    .sort((a, b) => (sort === 'AMOUNT' ? b.amount - a.amount : b.daysOverdue - a.daysOverdue || a.dueDate.localeCompare(b.dueDate)));

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Show" className="flex rounded-input border border-line p-0.5">
        {FILTERS.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`${SEGMENT} ${filter === value ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        Sort by
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-input border border-line bg-surface px-2 py-1 text-sm text-ink">
          <option value="DAYS_OVERDUE">Days overdue</option>
          <option value="AMOUNT">Amount</option>
        </select>
      </label>
    </div>
  );

  return (
    <Card title="Customer invoices" action={controls}>
      <p className="mb-4 text-sm text-muted">
        From Orbyte Connect. Overdue invoices are not counted in the cash projection until a reminder is approved; then they count by how likely the customer is to pay.
      </p>
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 rounded-input bg-canvas p-4 text-sm">
          <CircleCheck className="size-4 text-safe" aria-hidden="true" />
          {filter === 'OVERDUE' ? 'No overdue invoices. Every customer is up to date.' : 'No invoices here.'}
        </p>
      ) : (
        <table className={TABLE}>
          <TableHeader labels={['Invoice', 'Customer', 'Amount', 'Due date', 'Status', 'Likely to pay', 'Reminder', 'Last contact']} />
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`${TR} ${r.daysOverdue > 0 ? 'bg-shortfall/5' : ''}`}>
                <td data-label="Invoice" className={`${TD} font-medium`}>{r.id}</td>
                <td data-label="Customer" className={TD}>
                  <span>
                    {r.customer}
                    <span className="block text-xs text-muted">{r.contactName}</span>
                  </span>
                </td>
                <td data-label="Amount" className={TD}><Money amount={r.amount} /></td>
                <td data-label="Due date" className={TD}>{formatDate(r.dueDate)}</td>
                <td data-label="Status" className={TD}>
                  {r.daysOverdue > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-shortfall">
                      <TriangleAlert className="size-3.5" aria-hidden="true" />
                      {r.daysOverdue} days overdue
                    </span>
                  ) : (
                    <span className="text-muted">Not due yet</span>
                  )}
                </td>
                <td data-label="Likely to pay" className={`${TD} tabular-nums`}>{Math.round(r.likelihood * 100)}%</td>
                <td data-label="Reminder" className={TD}>{REMINDER[r.reminderStatus]}</td>
                <td data-label="Last contact" className={`${TD} text-muted`}>{r.lastContactAt ? formatDateTime(r.lastContactAt) : 'None yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
