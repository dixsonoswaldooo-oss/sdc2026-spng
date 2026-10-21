import { getAudit } from '@/api/client';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { useApi } from '@/lib/useApi';
import { ActivityItem } from './ActivityItem';

/** Audit trail: every agent run, data read, AI output and human decision, newest first. */
export function ActivityPage() {
  const audit = useApi(getAudit);

  if (!audit.data) {
    return audit.error ? <ErrorState message={audit.error.message} onRetry={audit.retry} /> : <Skeleton className="h-96" />;
  }

  return (
    <Card title="Activity log">
      <p className="mb-5 text-sm text-muted">
        Everything Cash Guard does is recorded here: what the agent read, what the AI produced, and who approved or rejected what, and why.
        People's decisions are highlighted.
      </p>
      {audit.data.length === 0 ? (
        <p className="text-sm text-muted">Nothing recorded yet.</p>
      ) : (
        <ol className="space-y-4">
          {audit.data.map((event) => (
            <ActivityItem key={event.id} event={event} />
          ))}
        </ol>
      )}
    </Card>
  );
}
