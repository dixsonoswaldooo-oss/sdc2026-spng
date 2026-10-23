'use client';
import { PaymentRuns } from '@/components/PaymentRuns';
import { PageHead } from '@/components/ui';
import { useMe } from '@/lib/useMe';

export default function Payslips() {
  const { data, me } = useMe();
  return (
    <>
      <PageHead eyebrow="Payslips" title="My payments">One payslip per paid month, newest first.</PageHead>
      <PaymentRuns runs={data.payments} onlyEmployeeId={me.id} />
    </>
  );
}
