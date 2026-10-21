import { useState } from 'react';
import { getActions, getProjection, getSummary, runCheck } from '@/api/client';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { useApi } from '@/lib/useApi';
import { AiExplanationCard } from './AiExplanationCard';
import { BreakdownList } from './BreakdownList';
import { KeyFigures } from './KeyFigures';
import { OverviewSkeleton } from './OverviewSkeleton';
import { ProjectionChart } from './ProjectionChart';
import { StatusBanner } from './StatusBanner';
import { WhatIfPanel } from './WhatIfPanel';

export function OverviewPage() {
  const summary = useApi(getSummary);
  const actions = useApi(getActions);
  const [picked, setPicked] = useState<string[] | null>(null); // null = all open actions ticked
  const openIds = (actions.data ?? []).filter((a) => a.status === 'PROPOSED' || a.status === 'PENDING_APPROVAL').map((a) => a.id);
  const selected = (picked ?? openIds).filter((id) => openIds.includes(id));
  const projection = useApi(getProjection, selected);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setRunError(null);
    try {
      await runCheck();
    } catch (error) {
      setRunError((error as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (!summary.data) {
    return summary.error ? <ErrorState message={summary.error.message} onRetry={summary.retry} /> : <OverviewSkeleton />;
  }
  const s = summary.data;

  return (
    <div className="space-y-6">
      <StatusBanner summary={s} running={running} runError={runError} onRun={run} />
      <KeyFigures summary={s} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {projection.data ? (
            <ProjectionChart
              points={projection.data.points}
              payday={s.payday}
              buffer={s.safetyBuffer}
              currentStatus={s.status}
              withActionsStatus={projection.data.withActions.status}
            />
          ) : projection.error ? (
            <ErrorState message={projection.error.message} onRetry={projection.retry} />
          ) : (
            <Skeleton className="h-80" />
          )}
          <BreakdownList summary={s} />
        </div>
        <div className="space-y-6">
          <AiExplanationCard ai={s.ai} />
          <WhatIfPanel
            actions={actions.data ?? []}
            selected={selected}
            onChange={setPicked}
            result={projection.data?.withActions}
            updating={projection.loading}
          />
        </div>
      </div>
    </div>
  );
}
