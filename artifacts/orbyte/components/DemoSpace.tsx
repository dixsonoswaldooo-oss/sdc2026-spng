'use client';
// Database mode: the demo space this browser works in, and how to share it with a second device or start over.
// Opening /login?space=CODE joins that space. Hidden in browser mode (each browser already has its own copy).
import { useEffect, useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';

export function DemoSpace({ compact = false }: { compact?: boolean }) {
  const { mode, space, joinSpace } = useStore();
  const [code, setCode] = useState('');
  const [note, setNote] = useState<[string, boolean] | null>(null);

  useEffect(() => {
    if (mode !== 'server' || compact) return;
    const wanted = new URLSearchParams(window.location.search).get('space')?.toUpperCase();
    if (!wanted) return;
    window.history.replaceState(null, '', window.location.pathname); // join once, keep the address clean
    if (wanted !== space) joinSpace(wanted).then(() => setNote([`Joined demo space ${wanted}.`, true])).catch((e: Error) => setNote([e.message, false]));
  }, [mode, compact, space, joinSpace]);

  if (mode !== 'server' || !space) return null;
  if (compact) return <span>Demo space <strong className="tabular">{space}</strong> · share or switch it on the sign-in page</span>;

  const link = `${window.location.origin}/login?space=${space}`;
  const join = (event: FormEvent) => {
    event.preventDefault();
    const wanted = code.trim().toUpperCase();
    joinSpace(wanted).then(() => { setCode(''); setNote([`Joined demo space ${wanted}.`, true]); }).catch((e: Error) => setNote([e.message, false]));
  };

  return (
    <div className="mt-8 rounded-[var(--radius)] border border-line bg-gray p-4 sm:p-5">
      <p className="text-xs font-semibold text-muted">Your demo space</p>
      <p className="tabular mt-1 text-[1.6rem] font-[650] tracking-[0.12em] text-navy">{space}</p>
      <p className="mt-1 text-sm text-text-70">
        Your own copy of the demo: what you do here doesn&apos;t change anyone else&apos;s. To show HR and an employee on two
        devices, open this link on the second one:
      </p>
      <p className="mt-2 break-all text-sm font-medium text-royal">{link}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button" className="btn btn-line"
          onClick={() => navigator.clipboard.writeText(link).then(() => setNote(['Link copied.', true])).catch(() => setNote(['Copy the link above by hand.', true]))}
        >Copy link</button>
        <button type="button" className="btn btn-ghost" onClick={() => joinSpace().then(() => setNote(['Started a fresh demo space.', true]))}>Start a fresh space</button>
      </div>
      <form onSubmit={join} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="field !mb-0 flex-1">
          <label htmlFor="space-code">Join another space</label>
          <input
            id="space-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6}
            placeholder="e.g. K7Q2MX" autoCapitalize="characters" autoComplete="off" spellCheck={false} className="tabular uppercase"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={code.trim().length !== 6}>Join</button>
      </form>
      {note && <p role={note[1] ? 'status' : 'alert'} className={`mt-3 text-sm font-medium ${note[1] ? 'text-success' : 'text-danger'}`}>{note[0]}</p>}
    </div>
  );
}
