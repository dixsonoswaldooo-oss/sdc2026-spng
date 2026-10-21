import { useState, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  reasonLabel?: string; // when set, a reason is required (used for Reject)
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/** The last check before anything happens: Approve shows exactly what will be done; Reject asks why. */
export function ConfirmDialog({ open, title, children, confirmLabel, danger, reasonLabel, busy, error, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const missingReason = reasonLabel !== undefined && reason.trim() === '';

  return (
    <Dialog open={open} onClose={onCancel} labelledBy="confirm-title">
      <form
        className="p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!missingReason) onConfirm(reason.trim());
        }}
      >
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-3 text-sm">{children}</div>
        {reasonLabel && (
          <div className="mt-4">
            <label htmlFor="confirm-reason" className="text-sm font-medium">
              {reasonLabel}
            </label>
            <textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required className="mt-1 w-full rounded-input border border-line p-2.5 text-sm" />
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-shortfall">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={busy || missingReason}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
