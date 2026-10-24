'use client';
// One-click payroll for the current month only: review → tick "I have checked" → Pay everyone → confirm. A paid month is
// locked. Earlier months are in Payment history.
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { Breakdown } from '@/components/Breakdown';
import { Badge, ErrorNote, Modal, Money, PageHead, Panel, TABLE, TD, TH } from '@/components/ui';
import { payrollFor } from '@/lib/engine';
import { dateTime, money, monthName, toSen } from '@/lib/format';
import { DEMO_MONTH } from '@/lib/seed';
import { useStore } from '@/lib/store';
import { rt, t, td } from '@/lib/i18n';

export default function Payroll() {
  const { data, payMonth } = useStore();
  const month = DEMO_MONTH;
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = data.payments.find((p) => p.month === month);
  const rows = data.employees.map((e) => ({ e, p: payrollFor(data, e.id, month) }));
  const total = (pick: (p: (typeof rows)[number]['p']) => number) => toSen(rows.reduce((t, r) => t + pick(r.p), 0));
  const waCount = (id: string) => data.whatsapp.filter((m) => m.employeeId === id && m.kind !== 'OVERTIME_OFFER').length;

  const pay = () => {
    setError(null);
    try {
      payMonth(month);
      setConfirming(false);
      setChecked(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <PageHead
        eyebrow={t('Payroll · this month')}
        title={`${t('Payroll')} · ${monthName(month)}`}
        action={<Link href="/hr/payments" className="btn btn-ghost !px-4 !py-2">{t('Earlier months →')}</Link>}
      >
        {t("Check everyone's pay for this month, then pay everyone at once. Earlier months are in Payment history. Simulated: no money is moved.")}
      </PageHead>

      {run && (
        <p className="mb-6 flex flex-wrap items-center gap-3 rounded-[var(--radius)] bg-gray px-5 py-4 text-sm">
          <Badge tone="success">{t('Paid · locked')}</Badge>
          <span>{t('Paid {when} by {who}', { when: dateTime(run.paidAt), who: run.paidBy })} · {t('{start} to {end}', { start: run.lines[0].reference, end: run.lines[run.lines.length - 1].reference })} · {t('total')} <Money amount={run.total} className="font-semibold" /></span>
          <span className="text-muted">{t('These amounts no longer change, even if settings change.')}</span>
        </p>
      )}

      <Panel>
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>{['Employee', 'Base', 'Bonus', 'Overtime', 'Gross', 'Deductions', 'Take-home', 'WhatsApp', run ? 'Reference' : 'Status'].map((h) => <th key={h} className={TH}>{t(h)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(({ e, p }) => (
                <Fragment key={e.id}>
                  <tr>
                    <td className={TD}><span className="font-semibold">{e.name}</span><span className="block text-xs text-muted">{td(e.position)}</span></td>
                    <td className={TD}><Money amount={p.baseSalary} /></td>
                    <td className={TD}><Money amount={p.bonus} /></td>
                    <td className={TD}><Money amount={p.overtimePay} /></td>
                    <td className={TD}><Money amount={p.gross} /></td>
                    <td className={TD}>
                      <button type="button" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)} className={`inline-flex min-h-11 cursor-pointer items-center underline decoration-dotted underline-offset-4 sm:min-h-0 ${p.totalDeductions ? 'text-danger' : 'text-muted'}`}>
                        <Money amount={p.totalDeductions} minus /> {open === e.id ? '▲' : '▼'}
                      </button>
                    </td>
                    <td className={`${TD} font-semibold`}>
                      <Money amount={p.netPay} />
                      {p.negativeClamped && <span className="ml-1"><Badge tone="danger">{t('Below zero')}</Badge></span>}
                    </td>
                    <td className={TD}>{waCount(e.id) ? <Badge tone="royal">{t('{n} alerts sent', { n: waCount(e.id) })}</Badge> : <span className="text-xs text-muted">{t('None needed')}</span>}</td>
                    <td className={TD}>{run && 'reference' in p ? <span className="tabular text-xs">{p.reference}</span> : <Badge tone={run ? 'success' : 'warn'}>{t(run ? 'Paid' : 'To pay')}</Badge>}</td>
                  </tr>
                  {open === e.id && (
                    <tr><td colSpan={9} className="border-b border-line bg-gray px-5 py-4"><div className="max-w-xl"><Breakdown p={p} /></div></td></tr>
                  )}
                </Fragment>
              ))}
              <tr className="font-semibold">
                <td className={TD}>{t('Total · {n} employees', { n: rows.length })}</td>
                <td className={TD}><Money amount={total((p) => p.baseSalary)} /></td>
                <td className={TD}><Money amount={total((p) => p.bonus)} /></td>
                <td className={TD}><Money amount={total((p) => p.overtimePay)} /></td>
                <td className={TD}><Money amount={total((p) => p.gross)} /></td>
                <td className={`${TD} text-danger`}><Money amount={total((p) => p.totalDeductions)} minus /></td>
                <td className={TD}><Money amount={total((p) => p.netPay)} /></td>
                <td className={TD} colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>

        {!run && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-white pt-6 max-sm:sticky max-sm:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-sm:z-30 max-sm:pb-4 max-sm:pt-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--royal)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              {t('I have checked the salary details above')}
            </label>
            <button type="button" className="btn btn-primary !px-7 !py-3" disabled={!checked} onClick={() => setConfirming(true)}>{t('Pay everyone')}</button>
          </div>
        )}
        <ErrorNote message={error} />
      </Panel>

      <Modal open={confirming} title={t('Pay {month}?', { month: monthName(month) })} onClose={() => setConfirming(false)}>
        <p className="text-text-70">{rt('You are about to pay {who} a total of {amount}.', { who: <strong className="text-navy">{t('{n} employees', { n: rows.length })}</strong>, amount: <strong className="text-navy">{money(total((p) => p.netPay))}</strong> })}</p>
        <p className="mt-2 text-sm text-muted">{t('After paying, {month} is locked: amounts stop changing, new requests for it are refused and it cannot be paid twice. (Simulated: no money is moved.)', { month: monthName(month) })}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>{t('Cancel')}</button>
          <button type="button" className="btn btn-primary" onClick={pay}>{t('Confirm')}</button>
        </div>
      </Modal>
    </>
  );
}
