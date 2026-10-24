'use client';
// Salary breakdown: base, bonus, overtime, gross, every deduction with its date and cause, take-home pay.
import { date } from '@/lib/format';
import type { PayrollBreakdown } from '@/lib/types';
import { Badge, Money } from './ui';
import { rt, t, tx } from '@/lib/i18n';

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const KIND: Record<string, { label: string; tone: 'danger' | 'warn' }> = {
  LATE: { label: 'Late', tone: 'warn' },
  ABSENT: { label: 'Absent', tone: 'danger' },
  LEAVE: { label: 'Unpaid leave', tone: 'danger' },
};

export function Breakdown({ p, compact = false }: { p: PayrollBreakdown; compact?: boolean }) {
  const rows: [string, number, boolean?][] = [
    [t('Base salary'), p.baseSalary],
    [t('Bonus'), p.bonus],
    [t('Overtime ({h} h, completed only)', { h: p.overtimeHours }), p.overtimePay],
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
          <dt>{t('Gross pay')}</dt>
          <dd><Money amount={p.gross} /></dd>
        </div>
        {[[t('Late deductions'), p.lateDeduction], [t('Absence deductions'), p.absentDeduction], [t('Unpaid leave deductions'), p.leaveDeduction]].map(([label, amount]) => (
          <div key={label as string} className="flex justify-between gap-4 py-2.5">
            <dt className="text-text-70">{label}</dt>
            <dd className={(amount as number) > 0 ? 'text-danger' : ''}><Money amount={amount as number} minus /></dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 py-3 text-base font-semibold">
          <dt>{t('Take-home pay')}</dt>
          <dd className="flex items-center gap-2">
            {p.negativeClamped && <Badge tone="danger">{t('Deductions exceed pay')}</Badge>}
            <Money amount={p.netPay} />
          </dd>
        </div>
      </dl>

      {!compact && (
        <div className="mt-5">
          <h3 className="text-[1rem]">{t('Deduction details')}</h3>
          {p.events.length === 0 ? (
            <p className="mt-2 text-muted">{t('No deductions this month.')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {p.events.map((e) => (
                <li key={e.key} className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-sm)] bg-gray px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Badge tone={KIND[e.kind].tone}>{t(KIND[e.kind].label)}</Badge>
                      <span className="text-xs text-muted">{date(e.date)}</span>
                    </span>
                    <span className="mt-1 block text-text-70">{capital(tx(e.explanation))}.</span>
                  </span>
                  <Money amount={e.amount} minus className="font-semibold text-danger" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">
            {rt('Daily wage ({n} working days): {amount}. Only attendance deductions are applied; income tax, EPF, SOCSO and EIS are not part of this demo.', { n: p.workingDays, amount: <Money amount={p.dailyWage} /> })}
          </p>
        </div>
      )}
    </div>
  );
}
