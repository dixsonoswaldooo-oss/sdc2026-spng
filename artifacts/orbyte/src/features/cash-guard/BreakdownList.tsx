import { ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import type { CashGuardSummary } from '@/api/types';
import { Card } from '@/components/Card';
import { Money } from '@/components/Money';

/** Balance → + sales → + receivables → − bills → − purchases → − payroll → result. Rows link to their source. */
export function BreakdownList({ summary }: { summary: CashGuardSummary }) {
  const b = summary.breakdown;
  const rows = [
    { label: 'Bank balance today', source: 'Orbyte Connect', amount: b.currentBalance },
    { label: '+ Expected sales until payday', source: '30-day POS average', amount: b.expectedSales },
    { label: '+ Invoices due by payday', source: 'Receivables', amount: b.expectedReceivables, href: '/receivables' },
    { label: '− Bills due by payday', source: 'Bills', amount: -b.billsDue, href: '/bills' },
    { label: '− Purchases before payday', source: 'Purchase orders', amount: -b.purchasesDue, href: '/bills' },
    { label: '= Balance on payday', amount: b.balanceBeforePayroll, total: true },
    { label: `− Payroll (${summary.headcount} staff)`, source: 'Orbyte People', amount: -summary.payrollTotal },
    { label: '= After payroll', amount: b.projectedAfterPayroll, total: true },
  ];

  return (
    <Card title="Where the number comes from" id="breakdown">
      <ul className="divide-y divide-line text-sm">
        {rows.map((row) => {
          const content = (
            <>
              <span className="min-w-0 flex-1">
                <span className={row.total ? 'font-semibold' : ''}>{row.label}</span>
                {row.source && <span className="block text-xs text-muted">{row.source}</span>}
              </span>
              <Money amount={row.amount} className={row.total ? 'font-semibold' : ''} />
              {row.href && <ChevronRight className="size-4 text-muted" aria-hidden="true" />}
            </>
          );
          return (
            <li key={row.label}>
              {row.href ? (
                <Link href={row.href} className="-mx-2 flex items-center gap-3 rounded-input px-2 py-2.5 hover:bg-canvas">
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-3 py-2.5 pr-6">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
