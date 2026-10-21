import type { Action, ProjectionResult } from '@/api/types';
import { Card } from '@/components/Card';
import { Money } from '@/components/Money';
import { StatusPill } from '@/components/StatusPill';

interface Props {
  actions: Action[];
  selected: string[];
  onChange: (ids: string[]) => void;
  result?: ProjectionResult['withActions'];
  updating: boolean;
}

const isOpen = (a: Action) => a.status === 'PROPOSED' || a.status === 'PENDING_APPROVAL';

/** Tick actions to see the payday result before deciding. The numbers come from the backend. */
export function WhatIfPanel({ actions, selected, onChange, result, updating }: Props) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <Card title="What if">
      {actions.length === 0 ? (
        <p className="text-sm text-muted">No actions to try right now.</p>
      ) : (
        <ul className="space-y-3">
          {actions.map((a) => (
            <li key={a.id}>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-accent"
                  checked={isOpen(a) ? selected.includes(a.id) : a.status === 'EXECUTED'}
                  disabled={!isOpen(a)}
                  onChange={() => toggle(a.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{a.title}</span>
                  <span className="block text-xs text-muted">
                    {isOpen(a) ? (
                      <>
                        Expected <Money amount={a.expectedImpact} signed /> by payday
                      </>
                    ) : a.status === 'EXECUTED' ? (
                      'Approved: already in the projection'
                    ) : (
                      'Rejected'
                    )}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 border-t border-line pt-4" aria-live="polite">
        <p className="text-sm text-muted">Projected after payroll</p>
        {result ? (
          <div className={`mt-1 flex flex-wrap items-center gap-3 transition-opacity ${updating ? 'opacity-50' : ''}`}>
            <Money amount={result.projectedAfterPayroll} signed className="text-xl font-semibold" />
            <StatusPill status={result.status} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">Calculating…</p>
        )}
        {updating && <span className="sr-only">Updating</span>}
      </div>
    </Card>
  );
}
