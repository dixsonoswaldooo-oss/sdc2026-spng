'use client';
// The running month as a draft payslip (recalculated live from attendance, overtime and leave), then the paid ones (frozen).
import { Breakdown } from '@/components/Breakdown';
import { PaymentRuns } from '@/components/PaymentRuns';
import { Badge, PageHead, Panel } from '@/components/ui';
import { isPaid, payrollFor } from '@/lib/engine';
import { monthName } from '@/lib/format';
import { DEMO_MONTH } from '@/lib/seed';
import { useMe } from '@/lib/useMe';

export default function Payslips() {
  const { data, me } = useMe();
  const draft = !isPaid(data, DEMO_MONTH) && payrollFor(data, me.id, DEMO_MONTH);
  return (
    <>
      <PageHead eyebrow="Payslips" title="My payments">
        This month&apos;s payslip updates by itself until HR pays it; paid payslips never change.
      </PageHead>
      {draft && (
        <Panel className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="eyebrow">Payslip · not paid yet</span>
              <h2 className="mt-1">{monthName(DEMO_MONTH)}</h2>
              <p className="mt-1 text-sm text-muted">Estimate: changes as soon as attendance, overtime or leave changes. Final when HR pays the month.</p>
            </div>
            <Badge tone="warn">Estimate</Badge>
          </div>
          <div className="mt-5 max-w-xl"><Breakdown p={draft} /></div>
        </Panel>
      )}
      <PaymentRuns runs={data.payments} onlyEmployeeId={me.id} />
    </>
  );
}
