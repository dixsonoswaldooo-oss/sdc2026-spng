import type { ReactNode } from 'react';
import type { Action, Bill, PurchaseOrder } from '@/api/types';
import { Money } from '@/components/Money';
import { formatDate } from '@/lib/format';

/** RESCHEDULE_BILL and HOLD_PURCHASE: the plain facts of the change. */
export function ActionFacts({ action, bills, purchaseOrders }: { action: Action; bills: Bill[]; purchaseOrders: PurchaseOrder[] }) {
  const rows: [string, ReactNode][] = [];

  if (action.type === 'RESCHEDULE_BILL') {
    for (const b of bills.filter((x) => action.relatedIds.includes(x.id))) {
      rows.push(['Bill', `${b.id} · ${b.vendor} (${b.description})`], ['Amount', <Money key="a" amount={b.amount} />]);
      rows.push(['Due date', b.shiftableTo && action.status !== 'EXECUTED' ? `${formatDate(b.dueDate)} → ${formatDate(b.shiftableTo)}` : formatDate(b.dueDate)]);
      rows.push(['Why it is allowed', b.termNote ?? '–'], ['Penalty', b.penalty > 0 ? <Money key="p" amount={b.penalty} /> : 'None']);
    }
  }
  if (action.type === 'HOLD_PURCHASE') {
    for (const p of purchaseOrders.filter((x) => action.relatedIds.includes(x.id))) {
      rows.push(['Order', `${p.id} · ${p.vendor} (${p.description})`], ['Amount', <Money key="a" amount={p.amount} />]);
      rows.push(['Order date', p.suggestedDate && action.status !== 'EXECUTED' ? `${formatDate(p.dueDate)} → ${formatDate(p.suggestedDate)} (after payday)` : formatDate(p.dueDate)]);
      rows.push(['Urgent', p.urgent ? 'Yes' : 'No, it can wait until after payday']);
    }
  }

  return (
    <dl className="divide-y divide-line rounded-input border border-line text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[8rem_1fr] gap-3 p-3">
          <dt className="text-muted">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
