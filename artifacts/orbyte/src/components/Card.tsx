import type { ReactNode } from 'react';

interface Props {
  title?: string;
  action?: ReactNode; // small control on the right of the title
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ title, action, id, className = '', children }: Props) {
  const headingId = id && title ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={`rounded-card border border-line bg-surface p-5 shadow-soft ${className}`}>
      {title && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id={headingId} className="text-base font-semibold">
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
