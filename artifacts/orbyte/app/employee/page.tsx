'use client';
import Link from 'next/link';
import { Breakdown } from '@/components/Breakdown';
import { Badge, Cell, Money, PageHead, Panel, Stat } from '@/components/ui';
import { isPaid, payrollFor } from '@/lib/engine';
import { monthName } from '@/lib/format';
import { DEMO_MONTH } from '@/lib/seed';
import { useMe } from '@/lib/useMe';

export default function MySalary() {
  const { data, me } = useMe();
  const p = payrollFor(data, me.id, DEMO_MONTH);
  const paid = isPaid(data, DEMO_MONTH);
  const pending = data.leaves.filter((l) => l.employeeId === me.id && l.status === 'PENDING').length
    + data.overtime.filter((o) => o.employeeId === me.id && ['REQUESTED', 'OFFERED', 'ACCEPTED', 'APPROVED'].includes(o.status)).length;

  return (
    <>
      <PageHead eyebrow={`Hi ${me.name.split(' ')[0]} · ${me.position}`} title={`My salary · ${monthName(DEMO_MONTH)}`}>
        {paid ? 'This month has been paid. Your payslip is in Payslips.' : 'An estimate that updates as soon as anything changes. You get a WhatsApp for every deduction.'}
      </PageHead>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
        <Cell className="col-span-2 sm:col-span-1"><Stat label={paid ? 'Paid take-home pay' : 'Estimated take-home pay'} value={<Money amount={p.netPay} />} note={paid ? <Badge tone="success">Paid</Badge> : 'Before payday'} /></Cell>
        <Cell delay={60}><Stat label="Deductions" value={<Money amount={p.totalDeductions} minus />} tone={p.totalDeductions ? 'danger' : 'success'} note={`${p.events.length} event${p.events.length === 1 ? '' : 's'}`} /></Cell>
        <Cell delay={120}>
          <Stat label="Open requests and offers" value={pending} />
          <Link href="/employee/requests" className="btn btn-line mt-3">Make a request →</Link>
        </Cell>
      </div>
      <Panel className="mt-6 sm:mt-8"><h2>Breakdown</h2><div className="mt-4 max-w-2xl"><Breakdown p={p} /></div></Panel>
    </>
  );
}
