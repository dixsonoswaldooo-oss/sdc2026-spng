import { CalendarClock, Lock } from 'lucide-react';
import { getBills, getPurchaseOrders, getSummary } from '@/api/client';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Money } from '@/components/Money';
import { Skeleton } from '@/components/Skeleton';
import { TableHeader as Header } from '@/components/TableHeader';
import { TABLE, TD, TR } from '@/components/tableStyles';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/useApi';

export function BillsPage() {
  const bills = useApi(getBills);
  const orders = useApi(getPurchaseOrders);
  const summary = useApi(getSummary);

  if (!bills.data || !orders.data || !summary.data) {
    const error = bills.error ?? orders.error ?? summary.error;
    return error ? <ErrorState message={error.message} onRetry={() => { bills.retry(); orders.retry(); summary.retry(); }} /> : <Skeleton className="h-72" />;
  }
  const payday = summary.data.payday;
  const timing = (date: string) => (date <= payday ? 'Before payday' : 'After payday');

  return (
    <div className="space-y-6">
      <Card title="Bills">
        <p className="mb-4 text-sm text-muted">From Orbyte Connect. Only bills whose terms allow a later date can be moved, and never with a penalty.</p>
        <table className={TABLE}>
          <Header labels={['Bill', 'Supplier', 'Amount', 'Due date', 'Can it move?', 'Penalty']} />
          <tbody>
            {bills.data.map((b) => (
              <tr key={b.id} className={TR}>
                <td data-label="Bill" className={`${TD} font-medium`}>{b.id}</td>
                <td data-label="Supplier" className={TD}>
                  <span>
                    {b.vendor}
                    <span className="block text-xs text-muted">{b.description}</span>
                  </span>
                </td>
                <td data-label="Amount" className={TD}><Money amount={b.amount} /></td>
                <td data-label="Due date" className={TD}>
                  <span>
                    {formatDate(b.dueDate)}
                    <span className="block text-xs text-muted">{timing(b.dueDate)}</span>
                  </span>
                </td>
                <td data-label="Can it move?" className={TD}>
                  <span className="max-w-xs">
                    <span className="inline-flex items-center gap-1 font-medium">
                      {b.shiftable ? <CalendarClock className="size-3.5 text-accent" aria-hidden="true" /> : <Lock className="size-3.5 text-muted" aria-hidden="true" />}
                      {b.shiftable ? `Yes, up to ${formatDate(b.shiftableTo ?? b.dueDate)}` : 'No'}
                    </span>
                    {b.termNote && <span className="block text-xs text-muted">{b.termNote}</span>}
                  </span>
                </td>
                <td data-label="Penalty" className={TD}>{b.penalty > 0 ? <Money amount={b.penalty} /> : 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Purchase orders">
        <p className="mb-4 text-sm text-muted">Orders waiting to be placed. Non-urgent ones can wait until after payday.</p>
        {orders.data.length === 0 ? (
          <p className="rounded-input bg-canvas p-4 text-sm text-muted">No pending purchase orders.</p>
        ) : (
          <table className={TABLE}>
            <Header labels={['Order', 'Supplier', 'Amount', 'Paid on', 'Urgent?']} />
            <tbody>
              {orders.data.map((p) => (
                <tr key={p.id} className={TR}>
                  <td data-label="Order" className={`${TD} font-medium`}>{p.id}</td>
                  <td data-label="Supplier" className={TD}>
                    <span>
                      {p.vendor}
                      <span className="block text-xs text-muted">{p.description}</span>
                    </span>
                  </td>
                  <td data-label="Amount" className={TD}><Money amount={p.amount} /></td>
                  <td data-label="Paid on" className={TD}>
                    <span>
                      {formatDate(p.dueDate)}
                      <span className="block text-xs text-muted">{timing(p.dueDate)}</span>
                    </span>
                  </td>
                  <td data-label="Urgent?" className={TD}>
                    {p.urgent ? 'Yes' : `No, can wait${p.suggestedDate && p.suggestedDate !== p.dueDate ? ` until ${formatDate(p.suggestedDate)}` : ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
