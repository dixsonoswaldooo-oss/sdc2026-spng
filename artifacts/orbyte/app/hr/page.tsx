'use client';
import Link from 'next/link';
import { Badge, Cell, Empty, Money, PageHead, Panel, Stat, TABLE, TD, TH } from '@/components/ui';
import { isPaid, payrollFor } from '@/lib/engine';
import { dateTime, monthName, toSen } from '@/lib/format';
import { DEMO_MONTH } from '@/lib/seed';
import { useStore } from '@/lib/store';

const CAUSE: Record<string, string> = { LATE: 'late', ABSENT: 'absent', LEAVE: 'unpaid leave' };

export default function HrDashboard() {
  const { data } = useStore();
  const rows = data.employees.map((e) => ({ e, p: payrollFor(data, e.id, DEMO_MONTH) }));
  const sum = (pick: (p: (typeof rows)[number]['p']) => number) => toSen(rows.reduce((t, r) => t + pick(r.p), 0));
  const deducted = rows.filter((r) => r.p.totalDeductions > 0); // the card count and the list below use this same list
  const pendingLeave = data.leaves.filter((l) => l.status === 'PENDING').length;
  const pendingOt = data.overtime.filter((o) => o.status === 'REQUESTED').length;
  const cancellations = [...data.leaves, ...data.overtime].filter((x) => x.cancelRequestedAt).length;
  const openOffers = data.overtime.filter((o) => o.status === 'OFFERED').length;
  const paid = data.payments.find((p) => p.month === DEMO_MONTH);

  return (
    <>
      <PageHead eyebrow={`Insight · ${monthName(DEMO_MONTH)}`} title="Payroll at a glance" action={<Link href="/hr/payroll" className="btn btn-primary">{paid ? 'View payroll' : 'Review payroll →'}</Link>}>
        Take-home pay is recalculated automatically whenever attendance, approvals or settings change.
      </PageHead>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Cell><Stat label="Total take-home pay" value={<Money amount={sum((p) => p.netPay)} />} note={`${rows.length} employees`} /></Cell>
        <Cell delay={60}><Stat label="Total overtime cost" value={<Money amount={sum((p) => p.overtimePay)} />} note="Completed overtime only" /></Cell>
        <Cell delay={120}><Stat label="Total bonus" value={<Money amount={sum((p) => p.bonus)} />} /></Cell>
        <Cell delay={180}>
          <Stat label="Employees with deductions" value={deducted.length} tone={deducted.length ? 'danger' : 'success'} note={<Money amount={sum((p) => p.totalDeductions)} />} />
          <Link href="#deductions" className="btn btn-line mt-4">View deductions →</Link>
        </Cell>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Cell>
          <p className="text-sm text-muted">Waiting for HR</p>
          <p className="mt-1 text-[1.7rem] font-[650] text-navy">{pendingLeave + pendingOt + cancellations}</p>
          <p className="mt-1 text-sm text-muted">{pendingLeave} leave · {pendingOt} overtime · {cancellations} cancellation requests</p>
          <Link href="/hr/approvals" className="btn btn-line mt-4">Open approvals →</Link>
        </Cell>
        <Cell delay={60}>
          <p className="text-sm text-muted">Overtime offers waiting for staff</p>
          <p className="mt-1 text-[1.7rem] font-[650] text-navy">{openOffers}</p>
          <Link href="/hr/salary#overtime" className="btn btn-line mt-4">Offer overtime →</Link>
        </Cell>
        <Cell delay={120}>
          <p className="text-sm text-muted">Payroll status</p>
          <p className="mt-2">{paid ? <Badge tone="success">Paid · locked</Badge> : <Badge tone="warn">Not paid yet</Badge>}</p>
          <p className="mt-2 text-sm text-muted">{paid ? `Paid ${dateTime(paid.paidAt)} by ${paid.paidBy}` : isPaid(data, DEMO_MONTH) ? '' : 'Pay everyone in one click after review.'}</p>
        </Cell>
      </div>

      <Panel className="mt-8">
        <div id="deductions" className="scroll-mt-40" />
        <h2>Who has deductions, and why ({deducted.length})</h2>
        {deducted.length === 0 ? <div className="mt-4"><Empty>No deductions this period.</Empty></div> : (
        <div className="mt-4 overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>{['Employee', 'Causes', 'Deducted', 'Take-home pay', 'WhatsApp'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {deducted.map(({ e, p }) => {
                const causes = Object.entries(p.events.reduce<Record<string, number>>((m, ev) => ({ ...m, [ev.kind]: (m[ev.kind] ?? 0) + 1 }), {}));
                const messages = data.whatsapp.filter((m) => m.employeeId === e.id);
                return (
                  <tr key={e.id}>
                    <td className={TD}><span className="font-semibold">{e.name}</span><span className="block text-xs text-muted">{e.position}</span></td>
                    <td className={TD}>
                      {causes.length === 0 ? <Badge tone="success">None</Badge> : (
                        <span className="flex flex-wrap gap-1">{causes.map(([k, n]) => <Badge key={k} tone={k === 'LATE' ? 'warn' : 'danger'}>{n}× {CAUSE[k]}</Badge>)}</span>
                      )}
                    </td>
                    <td className={`${TD} ${p.totalDeductions ? 'text-danger' : ''}`}><Money amount={p.totalDeductions} minus /></td>
                    <td className={`${TD} font-semibold`}><Money amount={p.netPay} /></td>
                    <td className={TD}>
                      {messages.length ? (
                        <span className="text-xs text-muted"><Badge tone="royal">{messages.length} sent (simulated)</Badge><span className="mt-1 block">last {dateTime(messages[0].at)}</span></span>
                      ) : <span className="text-xs text-muted">No messages</span>}
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
