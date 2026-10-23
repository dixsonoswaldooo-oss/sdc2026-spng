'use client';
// HR offers overtime to one or more employees; the offer also goes out by (simulated) WhatsApp.
import { useState, type FormEvent } from 'react';
import { ErrorNote, PageHead, Panel } from '@/components/ui';
import { money } from '@/lib/format';
import { useStore } from '@/lib/store';
import { OvertimeTable } from '@/components/requests';

export default function OvertimeOffers() {
  const { data, offerOvertime } = useStore();
  const [picked, setPicked] = useState<string[]>([]);
  const [day, setDay] = useState('2026-10-29');
  const [hours, setHours] = useState(2);
  const [note, setNote] = useState('Extra roasting for the weekend market.');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const name = (id: string) => data.employees.find((e) => e.id === id)!.name;
  const offers = data.overtime.filter((o) => o.origin === 'HR');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      offerOvertime(picked, { date: day, hours, note });
      setSent(`Offer sent to ${picked.length} employee${picked.length === 1 ? '' : 's'} by WhatsApp (simulated).`);
      setPicked([]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <PageHead eyebrow="Overtime offers" title="Offer overtime">
        Employees accept or decline in their portal, then mark it done after working it. Only completed overtime is paid.
      </PageHead>
      <Panel>
        <form onSubmit={submit}>
          <fieldset>
            <legend className="text-[0.85rem] font-semibold">Employees</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.employees.map((e) => (
                <label key={e.id} className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-3 text-sm transition ${picked.includes(e.id) ? 'border-royal bg-royal/5' : 'border-line bg-white'}`}>
                  <input type="checkbox" className="size-4 accent-[var(--royal)]" checked={picked.includes(e.id)} onChange={() => setPicked(picked.includes(e.id) ? picked.filter((x) => x !== e.id) : [...picked, e.id])} />
                  <span><span className="font-semibold">{e.name}</span><span className="block text-xs text-muted">{e.position}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 grid gap-x-6 sm:grid-cols-[1fr_1fr_2fr]">
            <div className="field"><label htmlFor="day">Date</label><input id="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></div>
            <div className="field"><label htmlFor="hours">Hours</label><input id="hours" type="number" min={0.5} max={12} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} required /></div>
            <div className="field"><label htmlFor="note">Note</label><input id="note" value={note} onChange={(e) => setNote(e.target.value)} required /></div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={!picked.length}>Send offer</button>
            <span className="text-sm text-muted">Worth {money(hours * data.config.overtimeRatePerHour)} per person at {money(data.config.overtimeRatePerHour)}/hour</span>
          </div>
          <ErrorNote message={error} />
          {sent && !error && <p role="status" className="mt-3 text-sm font-medium text-success">{sent}</p>}
        </form>
      </Panel>
      <Panel className="mt-8">
        <h2>Offers sent</h2>
        <OvertimeTable rows={offers} name={name} />
      </Panel>
    </>
  );
}
