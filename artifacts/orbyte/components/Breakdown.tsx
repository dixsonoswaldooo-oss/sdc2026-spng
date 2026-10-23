'use client';
// Salary breakdown: base, bonus, overtime, gross, every deduction with its date and cause, take-home pay.
import { date } from '@/lib/format';
import type { PayrollBreakdown } from '@/lib/types';
import { Badge, Money } from './ui';

const KIND: Record<string, { label: string; tone: 'danger' | 'warn' }> = {
  LATE: { label: 'Late', tone: 'warn' },
  ABSENT: { label: 'Absent', tone: 'danger' },
  LEAVE: { label: 'Unpaid leave', tone: 'danger' },
};

export function Breakdown({ p, compact = false }: { p: PayrollBreakdown; compact?: boolean }) {
  const rows: [string, number, boolean?][] = [
    ['Base salary', p.baseSalary],
    ['Bonus', p.bonus],
    [`Overtime (${p.overtimeHours} h, completed only)`, p.overtimePay],
  ];
  return (
    <div className="text-sm">
      <dl className="divide-y divide-line">
        {rows.map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-4 py-2.5">
            <dt className="text-text-70">{label}</dt>
            <dd><Money amount={amount} /></dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 py-2.5 font-semibold">
          <dt>Gross pay</dt>
          <dd><Money amount={p.gross} /></dd>
        </div>
        {[['Late deductions', p.lateDeduction], ['Absence deductions', p.absentDeduction], ['Unpaid leave deductions', p.leaveDeduction]].map(([label, amount]) => (
          <div key={label as string} className="flex justify-between gap-4 py-2.5">
            <dt className="text-text-70">{label}</dt>
            <dd className={(amount as number) > 0 ? 'text-danger' : ''}><Money amount={amount as number} minus /></dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 py-3 text-base font-semibold">
          <dt>Take-home pay</dt>
          <dd className="flex items-center gap-2">
            {p.negativeClamped && <Badge tone="danger">Deductions exceed pay</Badge>}
            <Money amount={p.netPay} />
          </dd>
        </div>
      </dl>

      {!compact && (
        <div className="mt-5">
          <h3 className="text-[1rem]">Deduction details</h3>
          {p.events.length === 0 ? (
            <p className="mt-2 text-muted">No deductions this month.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {p.events.map((e) => (
                <li key={e.key} className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-sm)] bg-gray px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Badge tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Badge>
                      <span className="text-xs text-muted">{date(e.date)}</span>
                    </span>
                    <span className="mt-1 block text-text-70">{e.explanation.charAt(0).toUpperCase() + e.explanation.slice(1)}.</span>
                  </span>
                  <Money amount={e.amount} minus className="font-semibold text-danger" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">
            Daily wage {p.workingDays} working days: <Money amount={p.dailyWage} />. Only attendance deductions are applied; income tax, EPF, SOCSO and EIS are not part of this demo.
          </p>
        </div>
      )}
    </div>
  );
}
