import { FileSpreadsheet, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { reloadFromSheet } from '@/api/client';
import { useDataSource } from '@/lib/useApi';

/** Tells the presenter what is going on with the Google Sheet, in plain words, with one button to act. */
export function SheetNotice() {
  const source = useDataSource();
  const [busy, setBusy] = useState(false);

  const message = source.error
    ? { title: 'Your Google Sheet could not be used, so the built-in demo data is shown.', detail: source.error, button: 'Read the sheet again', warn: true }
    : source.newEditProblem
      ? { title: 'Your latest change in the Google Sheet has a problem, so the previous data is still shown.', detail: source.newEditProblem, button: 'Read the sheet again', warn: true }
      : source.updateWaiting
        ? { title: 'Your Google Sheet has changed.', detail: 'Loading the new data restarts the demo, so approvals made so far are cleared.', button: 'Load the new data', warn: false }
        : null;
  if (!message) return null;
  const Icon = message.warn ? TriangleAlert : FileSpreadsheet;

  return (
    <div role={message.warn ? 'alert' : 'status'} className={`mb-5 flex flex-wrap items-start gap-3 rounded-card border p-4 text-sm ${message.warn ? 'border-at-risk/40 bg-at-risk/10' : 'border-accent/30 bg-accent/10'}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${message.warn ? 'text-at-risk' : 'text-accent'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{message.title}</p>
        <p className="mt-1 text-muted">{message.detail}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await reloadFromSheet();
          setBusy(false);
        }}
        className="inline-flex items-center gap-1.5 rounded-input border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-canvas disabled:opacity-50"
      >
        <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
        {busy ? 'Reading…' : message.button}
      </button>
    </div>
  );
}
