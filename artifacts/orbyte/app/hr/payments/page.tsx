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
        The running month is a live estimate until it is paid. Each paid month is a frozen snapshot of what was paid, with
        references, time and the HR person who paid it.
      </PageHead>
      <PaymentRuns runs={draft ? [draft, ...data.payments] : data.payments} />
    </>
  );
}
