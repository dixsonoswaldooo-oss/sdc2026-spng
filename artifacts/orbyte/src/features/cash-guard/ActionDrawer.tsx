import { Lock, X } from 'lucide-react';
import { useState } from 'react';
import { approveAction, getBills, getPurchaseOrders, getReceivables, rejectAction, submitAction } from '@/api/client';
import type { Action, DraftMessage } from '@/api/types';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { Skeleton } from '@/components/Skeleton';
import { useRole } from '@/lib/role';
import { useApi } from '@/lib/useApi';
import { ActionFacts } from './ActionFacts';
import { ActionStatusBadge } from './ActionStatusBadge';
import { approvalSummary } from './approvalSummary';
import { ChaseDetails } from './ChaseDetails';
import { ConfirmDialog } from './ConfirmDialog';
import { ACTION_TYPE_META, isOpenAction } from './actionMeta';

interface Props {
  action: Action;
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Side panel with everything about one action, and the role's buttons. */
export function ActionDrawer({ action, onClose, onDone }: Props) {
  const { role } = useRole();
  const receivables = useApi(getReceivables);
  const bills = useApi(getBills);
  const purchaseOrders = useApi(getPurchaseOrders);
  const [included, setIncluded] = useState(action.relatedIds);
  const [drafts, setDrafts] = useState<Record<string, DraftMessage>>(() => Object.fromEntries((action.drafts ?? []).map((d) => [d.receivableId, d])));
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = isOpenAction(action.status);
  const isChase = action.type === 'CHASE_RECEIVABLE';
  const chosenDrafts = isChase ? included.flatMap((id) => (drafts[id] ? [drafts[id]] : [])) : undefined;
  const loaded = receivables.data && bills.data && purchaseOrders.data;

  const act = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onDone(message);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const summary = loaded ? approvalSummary(action, chosenDrafts ?? [], receivables.data!, bills.data!, purchaseOrders.data!) : null;

  return (
    <Dialog open onClose={onClose} labelledBy="action-title" side="right">
      <div className="flex h-full flex-col">
        <header className="flex items-start gap-3 border-b border-line p-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{ACTION_TYPE_META[action.type].label}</p>
            <h2 id="action-title" className="mt-0.5 text-lg font-semibold">
              {action.title}
            </h2>
            <div className="mt-2">
              <ActionStatusBadge status={action.status} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-input p-2 hover:bg-canvas" aria-label="Close">
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <p className="text-sm text-muted">{action.reason}</p>
          {!loaded ? (
            <Skeleton className="h-48" />
          ) : isChase ? (
            <ChaseDetails action={action} receivables={receivables.data!} included={included} onIncludedChange={setIncluded} drafts={drafts} onDraftChange={(d) => setDrafts((all) => ({ ...all, [d.receivableId]: d }))} editable={open} />
          ) : (
            <ActionFacts action={action} bills={bills.data!} purchaseOrders={purchaseOrders.data!} />
          )}
        </div>

        <footer className="border-t border-line p-5">
          <p className="mb-3 flex items-center gap-2 text-xs text-muted">
            <Lock className="size-3.5" aria-hidden="true" />
            Nothing is sent or changed until the Owner approves.
          </p>
          {error && !confirming && (
            <p role="alert" className="mb-3 text-sm text-shortfall">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {open && role === 'OWNER' && (
              <>
                <Button variant="danger" onClick={() => setConfirming('reject')}>
                  Reject
                </Button>
                <Button onClick={() => setConfirming('approve')} disabled={!loaded || (isChase && included.length === 0)}>
                  Approve
                </Button>
              </>
            )}
            {action.status === 'PROPOSED' && role === 'FINANCE_ADMIN' && (
              <Button onClick={() => act(() => submitAction(action.id, chosenDrafts), 'Sent to the Owner for approval.')} disabled={busy || (isChase && included.length === 0)}>
                {busy ? 'Sending…' : 'Submit for approval'}
              </Button>
            )}
            {action.status === 'PENDING_APPROVAL' && role === 'FINANCE_ADMIN' && <p className="text-sm text-muted">Waiting for the Owner to approve. Only the Owner can approve.</p>}
            {!open && (
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </footer>
      </div>

      {confirming === 'approve' && summary && (
        <ConfirmDialog
          open
          title="Approve this action?"
          confirmLabel="Confirm and approve"
          busy={busy}
          error={error}
          onCancel={() => setConfirming(null)}
          onConfirm={() => act(() => approveAction(action.id, chosenDrafts), summary.toast)}
        >
          <p className="font-medium">{summary.headline}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {summary.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
      {confirming === 'reject' && (
        <ConfirmDialog
          open
          danger
          title="Reject this action?"
          confirmLabel="Reject"
          reasonLabel="Reason (saved in the activity log)"
          busy={busy}
          error={error}
          onCancel={() => setConfirming(null)}
          onConfirm={(reason) => act(() => rejectAction(action.id, reason), 'Action rejected. The reason is in the activity log.')}
        >
          <p className="text-muted">Nothing will be done for “{action.title}”.</p>
        </ConfirmDialog>
      )}
    </Dialog>
  );
}
