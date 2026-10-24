'use client';
// Payment history, one month at a time: pick any month of the year instead of scrolling. The running month is a live
// estimate until it is paid; paid months are frozen snapshots.
import { useState } from 'react';
import { PaymentRuns } from '@/components/PaymentRuns';
import { Empty, PageHead } from '@/components/ui';
import { draftRun } from '@/lib/engine';
import { monthName } from '@/lib/format';
import { DEMO_MONTH } from '@/lib/seed';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';

const year = DEMO_MONTH.slice(0, 4);
const MONTHS = Array.from({ length: Number(DEMO_MONTH.slice(5)) }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).reverse();

export default function PaymentHistory() {
  const { data } = useStore();
  const [month, setMonth] = useState(DEMO_MONTH);
  const draft = draftRun(data, DEMO_MONTH);
  const runs = draft ? [draft, ...data.payments] : data.payments;
  const run = runs.find((r) => r.month === month);
  const status = (m: string) => {
    const r = runs.find((x) => x.month === m);
    return t(!r ? 'no payroll' : r.draft ? 'not paid yet' : 'paid');
  };

  return (
    <>
      <PageHead
        eyebrow={t('Payment history')}
        title={t('Payments')}
        action={
          <div className="field !mb-0 min-w-[14rem]">
            <label htmlFor="month">{t('Month')}</label>
            <select id="month" value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTHS.map((m) => <option key={m} value={m}>{monthName(m)} · {status(m)}</option>)}
            </select>
          </div>
        }
      >
        {t('Pick a month to see what was paid, to whom, and by whom. This month is an estimate until it is paid in Payroll.')}
      </PageHead>
      {run ? <PaymentRuns runs={[run]} /> : <Empty>{t('No payroll was run in {month}: this demo company started paying through e-Salary Guard in {start}.', { month: monthName(month), start: monthName(`${year}-09`) })}</Empty>}
    </>
  );
}
