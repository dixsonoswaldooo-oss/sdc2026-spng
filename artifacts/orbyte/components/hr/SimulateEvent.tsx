'use client';
// Demo helper on the HR dashboard: make an employee late or absent on the last working day that has passed and show at
// once what follows — the WhatsApp alert they receive and their new take-home pay. Undo resets that day.
import Link from 'next/link';
import { useState } from 'react';
import { GuardedButton } from '@/components/requests';
import { ErrorNote, Money, Panel } from '@/components/ui';
import { lastWorkedDay, paidReason, payrollFor } from '@/lib/engine';
import { date } from '@/lib/format';
import { DEMO_MONTH } from '@/lib/seed';
import { useStore } from '@/lib/store';
import { t, tx } from '@/lib/i18n';

interface Result {
  employeeId: string;
  day: string;
  before: number;
  lastMessageId?: string; // newest WhatsApp before the event; everything newer was caused by it
}

export function SimulateEvent() {
  const { data, simulateEvent, setAttendance } = useStore();
  const [who, setWho] = useState('E3');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const day = lastWorkedDay(data, who);
  const blocked = !day ? t('No working day of this month has passed yet') : paidReason(data, [day]);
  const name = (id: string) => data.employees.find((e) => e.id === id)!.name;

  const run = (kind: 'LATE' | 'ABSENT') => {
    setError(null);
    const before = payrollFor(data, who, DEMO_MONTH).netPay;
    const lastMessageId = data.whatsapp.find((m) => m.employeeId === who)?.id;
    try {
      simulateEvent(who, kind);
      setResult({ employeeId: who, day: day!, before, lastMessageId });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const undo = () => {
    if (!result) return;
    setError(null);
    try {
      setAttendance(result.employeeId, result.day, null);
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const mine = result ? data.whatsapp.filter((m) => m.employeeId === result.employeeId) : [];
  const cut = result ? mine.findIndex((m) => m.id === result.lastMessageId) : -1; // newest first: everything before it is new
  const fresh = cut === -1 ? mine : mine.slice(0, cut);
  const after = result ? payrollFor(data, result.employeeId, DEMO_MONTH).netPay : 0;

  return (
    <Panel className="mt-8">
      <h2>{t('Try it live: simulate an event')}</h2>
      <p className="mt-2 max-w-2xl text-sm text-text-70">
        {t('Pick an employee and make something happen on {day}, the last working day that has passed. Their deduction, WhatsApp alert and take-home pay update at once.', { day: day ? date(day, { year: false }) : t('the last working day') })}
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="field !mb-0 min-w-[12rem] flex-1 sm:flex-none">
          <label htmlFor="sim-who">{t('Employee')}</label>
          <select id="sim-who" value={who} onChange={(e) => { setWho(e.target.value); setResult(null); }}>
            {data.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <GuardedButton label={t('25 min late')} primary blocked={blocked} onClick={() => run('LATE')} />
        <GuardedButton label={t("Didn't come in")} blocked={blocked} onClick={() => run('ABSENT')} />
      </div>
      <ErrorNote message={error} />

      {result && (
        <div role="status" className="mt-5 rounded-[var(--radius)] bg-gray p-4 sm:p-5">
          <p className="text-sm font-semibold">
            {name(result.employeeId)} · {date(result.day, { year: false })} · {t('take-home')} <Money amount={result.before} /> → <Money amount={after} className={after < result.before ? 'text-danger' : ''} />
          </p>
          {fresh.length ? fresh.map((m) => (
            <div key={m.id} className="mt-3 max-w-xl">
              <span className="text-xs font-semibold text-muted">{t('WhatsApp to {to} · ✓✓ Sent (simulated)', { to: m.to })}</span>
              <p className="mt-1 rounded-[18px] rounded-tl-[4px] bg-white px-4 py-3 text-sm leading-relaxed text-navy shadow-[0_1px_2px_rgba(11,30,77,0.08)]">{tx(m.text)}</p>
            </div>
          )) : <p className="mt-2 text-sm text-muted">{t('No new deduction: that day is covered by approved leave, or already had this deduction.')}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/hr/whatsapp?who=${result.employeeId}`} className="btn btn-ghost !px-4 !py-2">{t("Open {name}'s messages →", { name: name(result.employeeId).split(' ')[0] })}</Link>
            <button type="button" className="btn btn-ghost !px-4 !py-2" onClick={undo}>{t('Undo')}</button>
          </div>
        </div>
      )}
    </Panel>
  );
}
