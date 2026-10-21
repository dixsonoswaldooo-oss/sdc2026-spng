import { ArrowRight, RefreshCw } from 'lucide-react';
import type { CashGuardSummary } from '@/api/types';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { RunProgress } from './RunProgress';

interface Props {
  summary: CashGuardSummary;
  running: boolean;
  runError: string | null;
  onRun: () => void;
}

function headline({ status, breakdown, gapToBuffer, payday }: CashGuardSummary): string {
  const day = formatDate(payday);
  if (status === 'SHORTFALL') return `${formatMoney(-breakdown.projectedAfterPayroll)} short for payroll on ${day}`;
  if (status === 'AT_RISK') return `Payroll on ${day} is covered, but ${formatMoney(gapToBuffer)} below your safety buffer`;
  return `Payroll on ${day} is covered`;
}

export function StatusBanner({ summary, running, runError, onRun }: Props) {
  const safe = summary.status === 'SAFE';
  return (
    <section aria-label="Cash status" className="rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6">
      {running ? (
        <RunProgress />
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <StatusPill status={summary.status} size="base" />
            <p className="mt-3 text-xl font-semibold tracking-tight">{headline(summary)}</p>
            <p className="mt-1 text-sm text-muted">
              {summary.daysToPayday} days to payday · last checked {formatDateTime(summary.lastCheckedAt)}
              {safe && ' · No action needed.'}
            </p>
            {runError && (
              <p role="alert" className="mt-2 text-sm text-shortfall">
                The check did not finish: {runError}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!safe && (
              <Button href="/actions">
                Review actions
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            )}
            <Button variant="secondary" onClick={onRun}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Run check now
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
