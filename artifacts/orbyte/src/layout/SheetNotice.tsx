import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { reloadFromSheet } from '@/api/client';
import { useDataSource } from '@/lib/useApi';

/** Shown when the Google Sheet could not be used: says exactly what to fix, and that built-in data is shown meanwhile. */
export function SheetNotice() {
  const source = useDataSource();
  const [busy, setBusy] = useState(false);
  if (!source.error) return null;

  return (
    <div role="alert" className="mb-5 flex flex-wrap items-start gap-3 rounded-card border border-at-risk/40 bg-at-risk/10 p-4 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-at-risk" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Your Google Sheet could not be used, so the built-in demo data is shown.</p>
        <p className="mt-1 text-muted">{source.error}</p>
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
        {busy ? 'Reading…' : 'Read the sheet again'}
      </button>
    </div>
  );
}
