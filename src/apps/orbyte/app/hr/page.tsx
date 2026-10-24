'use client';
// HR's start page: what needs HR now (each with one button to where it's done), then the month's numbers,
// the "Try it live" demo and who has deductions.
import Link from 'next/link';
import { SimulateEvent } from '@/components/hr/SimulateEvent';
import { Badge, Cell, Empty, Money, PageHead, Panel, Stat, TABLE, TD, TH } from '@/components/ui';
import { payrollFor } from '@/lib/engine';
import { dateTime, money, monthName, toSen } from '@/lib/format';
import { DEMO_MONTH } from '@/lib/seed';
import { useStore } from '@/lib/store';
import { t, td, tn } from '@/lib/i18n';

const CAUSE: Record<string, string> = { LATE: '{n}× late', ABSENT: '{n}× absent', LEAVE: '{n}× unpaid leave' };

interface Task {
  title: string;
  detail: string;
  action: string;
  href: string;
  primary?: boolean;
}

export default function HrDashboard() {
  const { data } = useStore();
  const rows = data.employees.map((e) => ({ e, p: payrollFor(data, e.id, DEMO_MONTH) }));
  const sum = (pick: (p: (typeof rows)[number]['p']) => number) => toSen(rows.reduce((t, r) => t + pick(r.p), 0));
  const deducted = rows.filter((r) => r.p.totalDeductions > 0); // the card count and the list below use this same list
  const pendingLeave = data.leaves.filter((l) => l.status === 'PENDING').length;
  const pendingOt = data.overtime.filter((o) => o.status === 'REQUESTED').length;
  const cancellations = [...data.leaves, ...data.overtime].filter((x) => x.cancelRequestedAt).length;
  const openOffers = data.overtime.filter((o) => o.status === 'OFFERED').length;
  const updates = data.notifications.filter((n) => !n.read).length;
  const paid = data.payments.find((p) => p.month === DEMO_MONTH);
  const decide = pendingLeave + pendingOt + cancellations;

  const todo: Task[] = [];
  if (decide) {
    todo.push({
      title: tn(decide, '{n} request to decide', '{n} requests to decide'), action: t('Decide now →'), href: '/hr/approvals', primary: true,
      detail: [pendingLeave && t('{n} leave', { n: pendingLeave }), pendingOt && t('{n} overtime', { n: pendingOt }), cancellations && tn(cancellations, '{n} cancellation', '{n} cancellations')].filter(Boolean).join(' · '),
    });
  }
  if (updates) todo.push({ title: tn(updates, '{n} update from employees', '{n} updates from employees'), detail: t('A request was withdrawn or changed.'), action: t('Read →'), href: '/hr/approvals' });
  if (!paid) {
    todo.push({
      title: t('{month} is not paid yet', { month: monthName(DEMO_MONTH) }), action: t('Review payroll →'), href: '/hr/payroll', primary: !decide,
      detail: t('{amount} for {n} employees. Check it, then pay everyone in one click.', { amount: money(sum((p) => p.netPay)), n: rows.length }),
    });
  }
  if (deducted.length) {
    todo.push({
      title: tn(deducted.length, '{n} employee with a pay cut this month', '{n} employees with a pay cut this month'), action: t('See who →'), href: '#deductions',
      detail: t('{amount} in total. Each was told by WhatsApp when it happened.', { amount: money(sum((p) => p.totalDeductions)) }),
    });
  }

  return (
    <>
      <PageHead eyebrow={`${t('Dashboard')} · ${monthName(DEMO_MONTH)}`} title={t('Payroll at a glance')}>
        {t('Start with what needs you. The numbers below update by themselves.')}
      </PageHead>

      <Panel>
        <h2>{t('What needs you now')}</h2>
        {todo.length === 0 ? (
          <p className="mt-3 text-sm text-text-70">{t('All done for now. New requests from employees will show up here.')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {todo.map((t) => (
              <li key={t.title} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{t.title}</p>
                  <p className="text-sm text-muted">{t.detail}</p>
                </div>
                <Link href={t.href} className={`btn ${t.primary ? 'btn-primary' : 'btn-ghost'} !px-4 !py-2`}>{t.action}</Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 border-t border-line pt-3 text-sm text-muted">
          {t('Need extra hands?')} <Link href="/hr/salary#overtime" className="font-medium text-royal">{t('Offer overtime →')}</Link>
          {openOffers > 0 && ` (${tn(openOffers, '{n} offer waiting for staff to answer', '{n} offers waiting for staff to answer')})`}
        </p>
      </Panel>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-5 lg:grid-cols-4">
        <Cell><Stat label={t('Total take-home pay')} value={<Money amount={sum((p) => p.netPay)} />} note={`${t('{n} employees', { n: rows.length })} · ${paid ? t('paid {when}', { when: dateTime(paid.paidAt) }) : t('estimate')}`} /></Cell>
        <Cell delay={60}><Stat label={t('Overtime pay')} value={<Money amount={sum((p) => p.overtimePay)} />} note={t('Only overtime marked done')} /></Cell>
        <Cell delay={120}><Stat label={t('Bonuses')} value={<Money amount={sum((p) => p.bonus)} />} /></Cell>
        <Cell delay={180}>
          <Stat label={t('Employees with deductions')} value={deducted.length} tone={deducted.length ? 'danger' : 'success'} note={<Money amount={sum((p) => p.totalDeductions)} />} />
          <Link href="#deductions" className="btn btn-ghost mt-4">{t('View deductions →')}</Link>
        </Cell>
      </div>

      <SimulateEvent />

      <Panel className="mt-8">
        <div id="deductions" className="scroll-mt-40" />
        <h2>{t('Who has deductions, and why ({n})', { n: deducted.length })}</h2>
        {deducted.length === 0 ? <div className="mt-4"><Empty>{t('No pay cuts this month. Use Try it live above to see one happen.')}</Empty></div> : (
        <div className="mt-4 overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>{['Employee', 'Why', 'Cut from pay', 'Take-home pay', 'WhatsApp'].map((h) => <th key={h} className={TH}>{t(h)}</th>)}</tr>
            </thead>
            <tbody>
              {deducted.map(({ e, p }) => {
                const causes = Object.entries(p.events.reduce<Record<string, number>>((m, ev) => ({ ...m, [ev.kind]: (m[ev.kind] ?? 0) + 1 }), {}));
                const messages = data.whatsapp.filter((m) => m.employeeId === e.id);
                return (
                  <tr key={e.id}>
                    <td className={TD}><span className="font-semibold">{e.name}</span><span className="block text-xs text-muted">{td(e.position)}</span></td>
                    <td className={TD}>
                      <span className="flex flex-wrap gap-1">{causes.map(([k, n]) => <Badge key={k} tone={k === 'LATE' ? 'warn' : 'danger'}>{t(CAUSE[k], { n })}</Badge>)}</span>
                    </td>
                    <td className={`${TD} text-danger`}><Money amount={p.totalDeductions} minus /></td>
                    <td className={`${TD} font-semibold`}><Money amount={p.netPay} /></td>
                    <td className={TD}>
                      {messages.length ? (
                        <span className="text-xs text-muted"><Badge tone="royal">{t('{n} sent (simulated)', { n: messages.length })}</Badge><span className="mt-1 block">{t('last {when}', { when: dateTime(messages[0].at) })}</span></span>
                      ) : <span className="text-xs text-muted">{t('No messages')}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </Panel>
    </>
  );
}
