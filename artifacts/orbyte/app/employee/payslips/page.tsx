'use client';
// The running month as a live draft payslip, then the paid ones (frozen).
import { PaymentRuns } from '@/components/PaymentRuns';
import { PageHead } from '@/components/ui';
import { draftRun } from '@/lib/engine';
import { DEMO_MONTH } from '@/lib/seed';
import { useMe } from '@/lib/useMe';

export default function Payslips() {
  const { data, me } = useMe();
  const draft = draftRun(data, DEMO_MONTH);
  return (
    <>
      <PageHead eyebrow="Payslips" title="My payments">
        Your payslips. This month&apos;s updates by itself until HR pays it; paid ones never change.
      </PageHead>
      <PaymentRuns runs={draft ? [draft, ...data.payments] : data.payments} onlyEmployeeId={me.id} />
    </>
  );
}
