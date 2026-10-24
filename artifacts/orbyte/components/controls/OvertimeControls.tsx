'use client';
// Overtime offers: pick workers (one by one, a whole department, or everyone), a date and hours, then send.
// Rates per department live on the Rates page (OvertimeRates).
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { OvertimeTable } from '@/components/requests';
import { Notice, Panel } from '@/components/ui';
import { overtimeRate } from '@/lib/engine';
import { money } from '@/lib/format';
import { DIVISIONS } from '@/lib/seed';
import { useStore } from '@/lib/store';
import { rt, t, td, tn } from '@/lib/i18n';

const ALL = 'ALL';

export function OvertimeControls() {
  const { data, offerOvertime } = useStore();
  const [division, setDivision] = useState(ALL);
  const [picked, setPicked] = useState<string[]>([]);
  const [day, setDay] = useState(data.today);
  const [hours, setHours] = useState(2);
  const [note, setNote] = useState(() => t('Extra roasting for the weekend market.'));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const people = data.employees.filter((e) => division === ALL || e.division === division);
  const allPicked = people.length > 0 && people.every((e) => picked.includes(e.id));
  const name = (id: string) => data.employees.find((e) => e.id === id)!.name;

  const toggleAll = () => setPicked(allPicked ? [] : people.map((e) => e.id));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      offerOvertime(picked, { date: day, hours, note });
      setDone(tn(picked.length, 'Offer sent to {n} worker by WhatsApp (simulated).', 'Offer sent to {n} workers by WhatsApp (simulated).'));
      setPicked([]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Panel className="mt-6">
      <div id="overtime" className="scroll-mt-40" />
      <h2>{t('Offer overtime')}</h2>
      <p className="mt-2 max-w-2xl text-sm text-text-70">
        {t('Workers accept or decline, then mark it done after working it. Only completed overtime is paid.')}{' '}
        {rt('Rates per department are on the {rates} page.', { rates: <Link href="/hr/rates" className="font-medium text-royal">{t('Rates')}</Link> })}
      </p>

      <form onSubmit={submit} className="mt-5">
        <fieldset>
          <legend className="text-[0.85rem] font-semibold">{t('Workers')}</legend>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label htmlFor="division" className="sr-only">{t('Department')}</label>
            <select
              id="division" value={division} onChange={(e) => { setDivision(e.target.value); setPicked([]); setDone(null); }}
              className="rounded-[var(--radius-sm)] border border-line bg-white px-3 py-2 text-sm"
            >
              <option value={ALL}>{t('All departments')}</option>
              {DIVISIONS.map((d) => <option key={d} value={d}>{td(d)}</option>)}
            </select>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-5 accent-[var(--royal)]" checked={allPicked} onChange={toggleAll} disabled={!people.length} />
              {division === ALL ? t('Select all workers ({n})', { n: people.length }) : t('Select all workers in {department} ({n})', { department: td(division), n: people.length })}
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((e) => (
              <label key={e.id} className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-3 text-sm transition ${picked.includes(e.id) ? 'border-royal bg-royal/5' : 'border-line bg-white'}`}>
                <input type="checkbox" className="size-4 accent-[var(--royal)]" checked={picked.includes(e.id)} onChange={() => setPicked(picked.includes(e.id) ? picked.filter((x) => x !== e.id) : [...picked, e.id])} />
                <span>
                  <span className="font-semibold">{e.name}</span>
                  <span className="block text-xs text-muted">{td(e.position)} · {td(e.division)} · {t('{amount}/hour', { amount: money(overtimeRate(data, e)) })}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 grid grid-cols-2 gap-x-3 sm:grid-cols-[1fr_1fr_2fr] sm:gap-x-6">
          <div className="field"><label htmlFor="day">{t('Date')}</label><input id="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></div>
          <div className="field"><label htmlFor="hours">{t('Hours')}</label><input id="hours" type="number" min={0.5} max={12} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} required /></div>
          <div className="field col-span-2 sm:col-span-1"><label htmlFor="note">{t('Note')}</label><input id="note" value={note} onChange={(e) => setNote(e.target.value)} required /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={!picked.length}>{picked.length > 1 ? t('Send offer to {n} workers', { n: picked.length }) : t('Send offer')}</button>
          <span className="text-sm text-muted">
            {picked.length
              ? t('Worth {amount} in total once done', { amount: money(picked.reduce((sum, id) => sum + hours * overtimeRate(data, data.employees.find((e) => e.id === id)!), 0)) })
              : t('Choose who gets the offer')}
          </span>
        </div>
      </form>
      <Notice error={error} success={done} />

      <h3 className="mt-8 text-[1.05rem] font-semibold">{t('Offers sent')}</h3>
      <OvertimeTable rows={data.overtime.filter((o) => o.origin === 'HR')} name={name} />
    </Panel>
  );
}
