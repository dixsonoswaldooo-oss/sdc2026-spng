'use client';
// Small building blocks in Orbyte's style (gray rounded cells, royal accents, pill buttons).
import { useEffect, useRef, type ReactNode } from 'react';
import { money } from '@/lib/format';
import { Reveal } from './Reveal';

export function PageHead({ eyebrow, title, children, action }: { eyebrow: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="mt-2">{title}</h1>
        {children && <p className="mt-3 max-w-2xl text-text-70">{children}</p>}
      </div>
      {action}
    </Reveal>
  );
}

/** Orbyte's gray cell card. */
export function Cell({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={`cell !p-6 ${className}`}>
      {children}
    </Reveal>
  );
}

/** White panel with Orbyte's soft "stamp panel" shadow. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Reveal className={`rounded-[var(--radius-lg)] bg-white p-6 shadow-[0_30px_70px_-30px_rgba(11,11,12,0.18)] sm:p-8 ${className}`}>{children}</Reveal>;
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'danger' | 'success' }) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className={`tabular mt-1 text-[1.7rem] font-[650] tracking-[-0.02em] ${tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-navy'}`}>{value}</p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
    </div>
  );
}

const BADGE = {
  royal: 'bg-royal/10 text-royal',
  navy: 'bg-navy/[0.07] text-navy',
  danger: 'bg-danger/10 text-danger',
  success: 'bg-success/10 text-success',
  warn: 'bg-warn/10 text-warn',
  muted: 'bg-gray-deep text-muted',
};

export function Badge({ tone = 'navy', children }: { tone?: keyof typeof BADGE; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[tone]}`}>{children}</span>;
}

export function Money({ amount, minus = false, className = '' }: { amount: number; minus?: boolean; className?: string }) {
  return <span className={`tabular whitespace-nowrap ${className}`}>{minus && amount > 0 ? '−' : ''}{money(amount)}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[var(--radius)] bg-gray px-6 py-10 text-center text-sm text-muted">{children}</p>;
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="mt-3 text-sm font-medium text-danger">{message}</p>;
}

/** The browser's own modal dialog: traps focus, closes with Esc. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="modal-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[var(--radius-lg)] bg-white p-0 text-navy shadow-[0_30px_70px_-30px_rgba(11,11,12,0.35)] backdrop:bg-navy-deep/50 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="p-7">
          <h2 id="modal-title" className="text-[1.35rem]">{title}</h2>
          <div className="mt-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export interface Confirm {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}

/** "Are you sure?" built on Modal. `confirm` null = closed. */
export function ConfirmDialog({ confirm, onClose }: { confirm: Confirm | null; onClose: () => void }) {
  return (
    <Modal open={!!confirm} title={confirm?.title ?? ''} onClose={onClose}>
      <div className="text-sm text-text-70">{confirm?.body}</div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="btn btn-line" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={() => { confirm?.onConfirm(); onClose(); }}>{confirm?.confirmLabel}</button>
      </div>
    </Modal>
  );
}

/** Table styles shared by every list. */
export const TABLE = 'w-full border-collapse text-left text-sm';
export const TH = 'border-b border-line px-3 py-2.5 text-xs font-semibold text-muted';
export const TD = 'border-b border-line px-3 py-3 align-top';
