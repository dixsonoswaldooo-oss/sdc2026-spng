import type { Action, DraftMessage, Receivable } from '@/api/types';
import { Money } from '@/components/Money';
import { formatDate } from '@/lib/format';
import { DraftEditor } from './DraftEditor';

interface Props {
  action: Action;
  receivables: Receivable[];
  included: string[];
  onIncludedChange: (ids: string[]) => void;
  drafts: Record<string, DraftMessage>;
  onDraftChange: (draft: DraftMessage) => void;
  editable: boolean;
}

/** CHASE_RECEIVABLE: pick which invoices to chase and check each customer's message. */
export function ChaseDetails({ action, receivables, included, onIncludedChange, drafts, onDraftChange, editable }: Props) {
  const invoices = receivables.filter((r) => action.relatedIds.includes(r.id));
  const toggle = (id: string) => onIncludedChange(included.includes(id) ? included.filter((x) => x !== id) : [...included, id]);

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold">Invoices to chase</legend>
        <ul className="mt-2 divide-y divide-line rounded-input border border-line">
          {invoices.map((r) => (
            <li key={r.id}>
              <label className="flex items-start gap-3 p-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={included.includes(r.id)} disabled={!editable} onChange={() => toggle(r.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {r.id} · {r.customer}
                  </span>
                  <span className="block text-xs text-muted">
                    Due {formatDate(r.dueDate)} · {r.daysOverdue} days overdue · {Math.round(r.likelihood * 100)}% likely to pay
                  </span>
                </span>
                <Money amount={r.amount} className="font-medium" />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Messages</h3>
        {included.length === 0 && <p className="text-sm text-muted">Tick at least one invoice to chase.</p>}
        {invoices
          .filter((r) => included.includes(r.id) && drafts[r.id])
          .map((r) => (
            <DraftEditor key={r.id} actionId={action.id} customer={r.customer} draft={drafts[r.id]} editable={editable} onChange={onDraftChange} />
          ))}
      </div>
    </div>
  );
}
