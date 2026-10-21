import { Check, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { USE_MOCK } from '@/lib/env';

const STEPS = [
  'Reading payroll from People',
  'Reading balances and invoices from Connect',
  'Projecting cash to payday',
  'Asking AI for explanation and actions',
];

// The backend answers once at the end, so steps advance on a timer and the last one waits for the answer.
const STEP_MS = USE_MOCK ? 1000 : 12_000;

export function RunProgress() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div role="status" aria-live="polite">
      <p className="text-sm font-medium">Running the cash check…</p>
      <ol className="mt-3 space-y-2">
        {STEPS.map((label, i) => (
          <li key={label} className={`flex items-center gap-2 text-sm ${i > step ? 'text-muted' : 'text-ink'}`}>
            {i < step ? (
              <Check className="size-4 text-safe" aria-hidden="true" />
            ) : i === step ? (
              <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden="true" />
            ) : (
              <span className="size-4 rounded-full border border-line" aria-hidden="true" />
            )}
            {label}
            <span className="sr-only">{i < step ? '(done)' : i === step ? '(in progress)' : '(waiting)'}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">The AI may take up to a minute to wake up.</p>
    </div>
  );
}
