import type { CashGuardSummary } from '@/api/types';
import { Money } from '@/components/Money';
import { STATUS_META } from '@/lib/status';
import { formatMoney } from '@/lib/format';

export function KeyFigures({ summary }: { summary: CashGuardSummary }) {
  const { breakdown, status } = summary;
  const figures = [
    { label: 'Payroll due', amount: summary.payrollTotal, note: `${summary.headcount} staff, incl. EPF/SOCSO/EIS` },
    { label: 'Balance on payday', amount: breakdown.balanceBeforePayroll, note: 'Before payroll' },
    { label: 'Projected after payroll', amount: breakdown.projectedAfterPayroll, note: STATUS_META[status].label, tone: STATUS_META[status].text },
    { label: 'Gap to safety buffer', amount: summary.gapToBuffer, note: `Buffer ${formatMoney(summary.safetyBuffer)}` },
  ];

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {figures.map((f) => (
        <li key={f.label} className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <p className="text-sm text-muted">{f.label}</p>
          <Money amount={f.amount} className={`mt-1 block text-xl font-semibold ${f.tone ?? ''}`} />
          <p className={`mt-1 text-xs ${f.tone ?? 'text-muted'}`}>{f.note}</p>
        </li>
      ))}
    </ul>
  );
}
