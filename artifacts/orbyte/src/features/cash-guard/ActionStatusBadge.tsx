import type { ActionStatus } from '@/api/types';
import { ACTION_STATUS_META } from './actionMeta';

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  const meta = ACTION_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
