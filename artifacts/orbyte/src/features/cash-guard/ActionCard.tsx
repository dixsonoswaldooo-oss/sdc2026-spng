import type { Action } from '@/api/types';
import { AiBadge } from '@/components/AiBadge';
import { Button } from '@/components/Button';
import { Money } from '@/components/Money';
import { useRole } from '@/lib/role';
import { ACTION_TYPE_META, CONFIDENCE_LABEL, isOpenAction } from './actionMeta';
import { ActionStatusBadge } from './ActionStatusBadge';

export function ActionCard({ action, onOpen }: { action: Action; onOpen: () => void }) {
  const { role } = useRole();
  const type = ACTION_TYPE_META[action.type];
  const Icon = type.icon;
  const open = isOpenAction(action.status);
  const fallback = action.drafts?.some((d) => d.isFallback) ?? false;
  const label = !open ? 'View details' : role === 'OWNER' ? 'Review and decide' : 'Review and edit';

  return (
    <article className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="flex size-7 items-center justify-center rounded-input bg-accent/10 text-accent">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="font-medium">
          #{action.rank} · {type.label}
        </span>
        <AiBadge fallback={fallback} />
        <span className="ml-auto">
          <ActionStatusBadge status={action.status} />
        </span>
      </div>

      <h2 className="mt-3 text-base font-semibold">{action.title}</h2>
      <p className="mt-1 text-sm text-muted">{action.reason}</p>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Expected by payday</dt>
          <dd className="font-semibold text-safe">
            <Money amount={action.expectedImpact} signed />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Potential</dt>
          <dd>
            <Money amount={action.potentialImpact} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Confidence</dt>
          <dd>{CONFIDENCE_LABEL[action.confidence]}</dd>
        </div>
      </dl>

      <div className="mt-4 flex justify-end">
        <Button variant={open ? 'primary' : 'secondary'} onClick={onOpen}>
          {label}
        </Button>
      </div>
    </article>
  );
}
