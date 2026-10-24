'use client';
// The employee's start page: one plain sentence (how much, why less, anything to do), then the numbers and the breakdown.
import Link from 'next/link';
import { Breakdown } from '@/components/Breakdown';
import { Badge, Cell, Money, PageHead, Panel, Stat } from '@/components/ui';
import { isPaid, payrollFor } from '@/lib/engine';
import { date, money, monthName } from '@/lib/format';
import { DEMO_MONTH } from '@/lib/seed';
import { useMe } from '@/lib/useMe';
import type { PayrollBreakdown } from '@/lib/types';

const times = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);
const CAUSE: Record<string, (n: number) => string> = {
  LATE: (n) => `you were late ${n === 2 ? 'twice' : times(n, 'once', 'times')}`,
  ABSENT: (n) => `you were absent ${times(n, 'one day', 'days')}`,
  LEAVE: (n) => `you took ${times(n, 'one day', 'days')} of unpaid leave`,
};

/** "you were late twice (14 & 21 Oct) and you were absent one day (9 Oct)" */
function why(p: PayrollBreakdown): string {
  const parts = Object.entries(CAUSE).flatMap(([kind, say]) => {
    const days = p.events.filter((e) => e.kind === kind).map((e) => date(e.date, { year: false }));
    return days.length ? [`${say(days.length)} (${days.join(', ').replace(/, ([^,]*)$/, ' & $1')})`] : [];
  });
  return parts.join(' and ');
}

export default function MySalary() {
  const { data, me } = useMe();
  const p = payrollFor(data, me.id, DEMO_MONTH);
  const paid = isPaid(data, DEMO_MONTH);
  const offers = data.overtime.filter((o) => o.employeeId === me.id && o.status === 'OFFERED').length;
  const pending = data.leaves.filter((l) => l.employeeId === me.id && l.status === 'PENDING').length
    + data.overtime.filter((o) => o.employeeId === me.id && ['REQUESTED', 'ACCEPTED', 'APPROVED'].includes(o.status)).length;

  return (
    <>
      <PageHead eyebrow={`Hi ${me.name.split(' ')[0]} · ${me.position}`} title={`My salary · ${monthName(DEMO_MONTH)}`}>
        This page shows what you will be paid and why.
      </PageHead>

      <Panel>
        <p className="text-lg leading-relaxed text-navy">
          {paid ? 'You were paid ' : "You'll get about "}<strong><Money amount={p.netPay} /></strong> for {monthName(DEMO_MONTH).split(' ')[0]}.{' '}
          {p.totalDeductions > 0
            ? <><strong className="text-danger">{money(p.totalDeductions)}</strong> was cut because {why(p)}.</>
            : 'Nothing was cut from your pay.'}
        </p>
        <p className="mt-2 text-sm text-text-70">
          {offers > 0 ? (
            <>You have {offers === 1 ? 'an overtime offer' : `${offers} overtime offers`} to answer. <Link href="/employee/offers" className="font-medium text-royal">Answer now →</Link></>
          ) : pending > 0 ? (
            <>Nothing to do. {pending === 1 ? 'One request is' : `${pending} requests are`} waiting for HR.</>
          ) : paid ? 'Nothing to do. Your payslip is in Payslips.' : 'Nothing to do. This updates by itself, and you get a WhatsApp for every cut.'}
        </p>
      </Panel>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-5">
        <Cell className="col-span-2 sm:col-span-1"><Stat label={paid ? 'Paid take-home pay' : 'Estimated take-home pay'} value={<Money amount={p.netPay} />} note={paid ? <Badge tone="success">Paid</Badge> : 'Before payday'} /></Cell>
        <Cell delay={60}><Stat label="Cut from pay" value={<Money amount={p.totalDeductions} minus />} tone={p.totalDeductions ? 'danger' : 'success'} note={`${p.events.length} event${p.events.length === 1 ? '' : 's'}`} /></Cell>
        <Cell delay={120}>
          <Stat label="Open requests and offers" value={pending + offers} />
          <Link href="/employee/requests" className="btn btn-ghost mt-3 !px-4 !py-2">Make a request →</Link>
        </Cell>
      </div>
      <Panel className="mt-6 sm:mt-8"><h2>Breakdown</h2><div className="mt-4 max-w-2xl"><Breakdown p={p} /></div></Panel>
    </>
  );
}
