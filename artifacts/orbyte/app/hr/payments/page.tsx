'use client';
import { PaymentRuns } from '@/components/PaymentRuns';
import { PageHead } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function PaymentHistory() {
  const { data } = useStore();
  return (
    <>
      <PageHead eyebrow="Payment history" title="Payments made">
        Each month is a frozen snapshot of what was paid, with references, time and the HR person who paid it.
      </PageHead>
      <PaymentRuns runs={data.payments} />
    </>
  );
}
