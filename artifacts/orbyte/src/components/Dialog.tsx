import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  side?: 'center' | 'left' | 'right'; // left/right = drawer
  children: ReactNode;
}

const PLACEMENT = {
  center: 'm-auto w-[calc(100%-2rem)] max-w-md rounded-card',
  left: 'my-0 ml-0 mr-auto h-full max-h-none w-72 max-w-[85vw]',
  right: 'my-0 ml-auto mr-0 h-full max-h-none w-full max-w-xl',
};

/**
 * The browser's own modal dialog: it keeps keyboard focus inside, closes with Esc,
 * and makes the page behind it unclickable. Clicking the dimmed backdrop also closes it.
 */
export function Dialog({ open, onClose, labelledBy, side = 'center', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`bg-surface p-0 text-ink shadow-soft backdrop:bg-ink/40 ${PLACEMENT[side]}`}
    >
      {open && children}
    </dialog>
  );
}
