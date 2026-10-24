'use client';
import { PaymentRuns } from '@/components/PaymentRuns';
import { PageHead } from '@/components/ui';
import { draftRun } from '@/lib/engine';
import { DEMO_MONTH } from '@/lib/seed';
import { useStore } from '@/lib/store';

export default function PaymentHistory() {
  const { data } = useStore();
  const draft = draftRun(data, DEMO_MONTH);
  return (
    <>
      <PageHead eyebrow="Payment history" title="Payments">
        Look back at what was paid each month, and by whom. The running month is an estimate until it is paid.
      </PageHead>
      <PaymentRuns runs={draft ? [draft, ...data.payments] : data.payments} />
    </>
  );
}
