import type { Status } from '@/api/types';
import { STATUS_META } from '@/lib/status';

export function StatusPill({ status, size = 'sm' }: { status: Status; size?: 'sm' | 'base' }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ${meta.tint} ${meta.text} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
