'use client';
// The employee's start page: one plain sentence (how much, why less, anything to do), then the numbers and the breakdown.
import Link from 'next/link';
import { Breakdown } from '@/components/Breakdown';
import { Badge, Cell, Money, PageHead, Panel, Stat } from '@/components/ui';
import { isPaid, payrollFor } from '@/lib/engine';
import { date, money, monthName } from '@/lib/format';
import { getLang, rt, t, td, tn } from '@/lib/i18n';
import { DEMO_MONTH } from '@/lib/seed';
import { useMe } from '@/lib/useMe';
import type { PayrollBreakdown } from '@/lib/types';

/** English keeps "once / twice / N times"; the other languages translate the "{n}" form. */
const CAUSE: Record<string, (n: number, days: string) => string> = {
  LATE: (n, days) => t(n === 1 ? 'you were late once ({days})' : n === 2 ? 'you were late twice ({days})' : 'you were late {n} times ({days})', { n, days }),
  ABSENT: (n, days) => tn(n, 'you were absent one day ({days})', 'you were absent {n} days ({days})', { days }),
  LEAVE: (n, days) => tn(n, 'you took one day of unpaid leave ({days})', 'you took {n} days of unpaid leave ({days})', { days }),
};

/** "you were late twice (14 Oct & 21 Oct) and you were absent one day (9 Oct)" */
function why(p: PayrollBreakdown): string {
  const parts = Object.entries(CAUSE).flatMap(([kind, say]) => {
    const days = p.events.filter((e) => e.kind === kind).map((e) => date(e.date, { year: false }));
    return days.length ? [say(days.length, days.length > 1 ? t('{list} & {last}', { list: days.slice(0, -1).join(', '), last: days.at(-1)! }) : days[0])] : [];
  });
  return parts.reduce((all, part) => t('{first} and {second}', { first: all, second: part }));
}

export default function MySalary() {
  const { data, me } = useMe();
  const p = payrollFor(data, me.id, DEMO_MONTH);
  const paid = isPaid(data, DEMO_MONTH);
  const offers = data.overtime.filter((o) => o.employeeId === me.id && o.status === 'OFFERED').length;
  const pending = data.leaves.filter((l) => l.employeeId === me.id && l.status === 'PENDING').length
    + data.overtime.filter((o) => o.employeeId === me.id && ['REQUESTED', 'ACCEPTED', 'APPROVED'].includes(o.status)).length;
  const month = monthName(DEMO_MONTH);
  const amount = <strong><Money amount={p.netPay} /></strong>;

  return (
    <>
      <PageHead eyebrow={`${t('Hi {name}', { name: me.name.split(' ')[0] })} · ${td(me.position)}`} title={`${t('My salary')} · ${month}`}>
        {t('This page shows what you will be paid and why.')}
      </PageHead>

      <Panel>
        <p className="text-lg leading-relaxed text-navy">
          {rt(paid ? 'You were paid {amount} for {month}.' : "You'll get about {amount} for {month}.", { amount, month })}{getLang() === 'zh' ? '' : ' '}
          {p.totalDeductions > 0
            ? rt('{cut} was cut because {why}.', { cut: <strong className="text-danger">{money(p.totalDeductions)}</strong>, why: why(p) })
            : t('Nothing was cut from your pay.')}
        </p>
        <p className="mt-2 text-sm text-text-70">
          {offers > 0 ? (
            <>{tn(offers, 'You have an overtime offer to answer.', 'You have {n} overtime offers to answer.')} <Link href="/employee/offers" className="font-medium text-royal">{t('Answer now →')}</Link></>
          ) : pending > 0 ? (
            tn(pending, 'Nothing to do. One request is waiting for HR.', 'Nothing to do. {n} requests are waiting for HR.')
          ) : t(paid ? 'Nothing to do. Your payslip is in Payslips.' : 'Nothing to do. This updates by itself, and you get a WhatsApp for every cut.')}
        </p>
      </Panel>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-5">
        <Cell className="col-span-2 sm:col-span-1"><Stat label={t(paid ? 'Paid take-home pay' : 'Estimated take-home pay')} value={<Money amount={p.netPay} />} note={paid ? <Badge tone="success">{t('Paid')}</Badge> : t('Before payday')} /></Cell>
        <Cell delay={60}><Stat label={t('Cut from pay')} value={<Money amount={p.totalDeductions} minus />} tone={p.totalDeductions ? 'danger' : 'success'} note={tn(p.events.length, '{n} event', '{n} events')} /></Cell>
        <Cell delay={120}>
          <Stat label={t('Open requests and offers')} value={pending + offers} />
          <Link href="/employee/requests" className="btn btn-ghost mt-3 !px-4 !py-2">{t('Make a request →')}</Link>
        </Cell>
      </div>
      <Panel className="mt-6 sm:mt-8"><h2>{t('Breakdown')}</h2><div className="mt-4 max-w-2xl"><Breakdown p={p} /></div></Panel>
    </>
  );
}
