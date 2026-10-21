import { CloudOff, FlaskConical, HandCoins, RefreshCw, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { resetDemo, runCheck, simulateAiDown, simulatePayments } from '@/api/client';
import { Dialog } from '@/components/Dialog';
import { Toast } from '@/components/Toast';
import { RunProgress } from '@/features/cash-guard/RunProgress';

const CONTROLS = [
  { id: 'run', label: 'Run check now', note: 'Runs the agent again: reads data, projects cash, asks the AI.', icon: RefreshCw, work: runCheck, done: 'Check finished. Every screen is up to date.' },
  { id: 'pay', label: 'Simulate: customers pay', note: 'All overdue invoices are paid in full today.', icon: HandCoins, work: simulatePayments, done: 'Overdue invoices paid. See the new status on Overview.' },
  { id: 'ai', label: 'Simulate: AI unavailable', note: 'Shows the rules-based fallback with its badge.', icon: CloudOff, work: simulateAiDown, done: 'AI marked unavailable. Fallback text is now shown.' },
  { id: 'reset', label: 'Reset demo data', note: 'Back to the start of the story (21 Oct, shortfall).', icon: RotateCcw, work: resetDemo, done: 'Demo data reset.' },
] as const;

/** Floating "Demo" button for the presenter (only when VITE_DEMO_MODE=true). */
export function DemoControls() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const trigger = async (control: (typeof CONTROLS)[number]) => {
    setBusy(control.id);
    setError(null);
    try {
      await control.work();
      setOpen(false);
      setToast(control.done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-ink/90"
      >
        <FlaskConical className="size-4" aria-hidden="true" />
        Demo
      </button>

      <Dialog open={open} onClose={() => !busy && setOpen(false)} labelledBy="demo-title" side="corner">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h2 id="demo-title" className="text-sm font-semibold">
              Demo controls
            </h2>
            <button type="button" onClick={() => setOpen(false)} disabled={!!busy} className="rounded-input p-1.5 hover:bg-canvas" aria-label="Close demo controls">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">For presenting only. Each step is written to the activity log.</p>

          {busy === 'run' ? (
            <div className="mt-4">
              <RunProgress />
            </div>
          ) : (
            <ul className="mt-3 space-y-1">
              {CONTROLS.map((c) => (
                <li key={c.id}>
                  <button type="button" disabled={!!busy} onClick={() => trigger(c)} className="flex w-full items-start gap-3 rounded-input p-2.5 text-left hover:bg-canvas disabled:opacity-50">
                    <c.icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-medium">{busy === c.id ? 'Working…' : c.label}</span>
                      <span className="block text-xs text-muted">{c.note}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-shortfall">
              {error}
            </p>
          )}
        </div>
      </Dialog>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
