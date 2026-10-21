import { CircleCheck, X } from 'lucide-react';
import { useEffect } from 'react';

/** Short confirmation at the bottom of the screen. Screen readers announce it. Hides itself after 6 s. */
export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {message && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-card bg-ink px-4 py-3 text-sm text-white shadow-soft">
          <CircleCheck className="size-4 shrink-0 text-white" aria-hidden="true" />
          <span>{message}</span>
          <button type="button" onClick={onDismiss} className="rounded p-0.5 text-white/70 hover:text-white" aria-label="Dismiss">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
