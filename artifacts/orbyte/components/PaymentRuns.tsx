'use client';
// Payment history from the frozen snapshots, newest month first. Employees see only their own line.
import { useState } from 'react';
import { dateTime, monthName } from '@/lib/format';
import type { PaymentRun } from '@/lib/types';
import { Breakdown } from './Breakdown';
import { Badge, Empty, Money, Panel, TABLE, TD, TH } from './ui';

export function PaymentRuns({ runs, onlyEmployeeId }: { runs: PaymentRun[]; onlyEmployeeId?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...runs].sort((a, b) => b.month.localeCompare(a.month));
  if (!sorted.length) return <Empty>No payments yet.</Empty>;

  return (
    <div className="space-y-8">
      {sorted.map((run) => {
        const lines = onlyEmployeeId ? run.lines.filter((l) => l.employeeId === onlyEmployeeId) : run.lines;
        return (
          <Panel key={run.month}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="eyebrow">{onlyEmployeeId ? 'Payslip' : 'Payment run'}</span>
                <h2 className="mt-1">{monthName(run.month)}</h2>
                <p className="mt-1 text-sm text-muted">
                  Paid {dateTime(run.paidAt)} by {run.paidBy}
                  {onlyEmployeeId ? ` · reference ${lines[0]?.reference}` : ` · ${run.lines[0].reference} to ${run.lines[run.lines.length - 1].reference}`}
                </p>
              </div>
              <div className="text-right">
                <Badge tone="success">Paid</Badge>
                {!onlyEmployeeId && <p className="mt-2 text-sm text-muted">{run.lines.length} employees · total <Money amount={run.total} className="font-semibold text-navy" /></p>}
              </div>
            </div>

            {onlyEmployeeId && lines[0] ? (
              <div className="mt-5 max-w-xl"><Breakdown p={lines[0]} /></div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className={TABLE}>
                  <thead><tr>{['Reference', 'Employee', 'Gross', 'Deductions', 'Take-home', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
                  <tbody>
                    {lines.map((l) => {
                      const key = `${run.month}|${l.employeeId}`;
                      return [
                        <tr key={key}>
                          <td className={`${TD} tabular text-xs`}>{l.reference}</td>
                          <td className={TD}>{l.employeeName}</td>
                          <td className={TD}><Money amount={l.gross} /></td>
                          <td className={`${TD} ${l.totalDeductions ? 'text-danger' : ''}`}><Money amount={l.totalDeductions} minus /></td>
                          <td className={`${TD} font-semibold`}><Money amount={l.netPay} /></td>
                          <td className={TD}><button type="button" className="btn btn-line" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>{open === key ? 'Hide' : 'Details'}</button></td>
                        </tr>,
                        open === key && <tr key={`${key}-d`}><td colSpan={6} className="border-b border-line bg-gray px-5 py-4"><div className="max-w-xl"><Breakdown p={l} /></div></td></tr>,
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
