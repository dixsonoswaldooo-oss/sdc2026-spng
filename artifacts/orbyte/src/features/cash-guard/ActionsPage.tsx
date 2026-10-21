import { CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { getActions } from '@/api/client';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { Toast } from '@/components/Toast';
import { ROLE_LABELS, useRole } from '@/lib/role';
import { useApi } from '@/lib/useApi';
import { ActionCard } from './ActionCard';
import { ActionDrawer } from './ActionDrawer';

export function ActionsPage() {
  const { role } = useRole();
  const actions = useApi(getActions);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const opened = actions.data?.find((a) => a.id === openId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted">
          Ranked by AI from a fixed list: chase invoices, move a bill within its terms, or hold a purchase. Salaries are never delayed or cut.
          Nothing happens until the Owner approves.
        </p>
        <p className="text-xs text-muted">Viewing as {ROLE_LABELS[role]}</p>
      </div>

      {actions.error && !actions.data ? (
        <ErrorState message={actions.error.message} onRetry={actions.retry} />
      ) : !actions.data ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      ) : actions.data.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center shadow-soft">
          <CircleCheck className="mx-auto size-6 text-safe" aria-hidden="true" />
          <p className="mt-2 font-medium">No actions needed</p>
          <p className="mt-1 text-sm text-muted">Cash covers payroll. Cash Guard checks again every morning.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {actions.data.map((a) => (
            <li key={a.id}>
              <ActionCard action={a} onOpen={() => setOpenId(a.id)} />
            </li>
          ))}
        </ul>
      )}

      {opened && (
        <ActionDrawer
          key={opened.id}
          action={opened}
          onClose={() => setOpenId(null)}
          onDone={(message) => {
            setOpenId(null);
            setToast(message);
          }}
        />
      )}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
