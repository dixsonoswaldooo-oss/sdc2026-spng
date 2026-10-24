'use client';
// Overtime rules and offers, per division. The global rate is the default; a division can override it.
import { useState, type FormEvent } from 'react';
import { OvertimeTable } from '@/components/requests';
import { Badge, ErrorNote, Panel, TABLE, TD, TH } from '@/components/ui';
import { overtimeRate } from '@/lib/engine';
import { money } from '@/lib/format';
import { DIVISIONS } from '@/lib/seed';
import { useStore } from '@/lib/store';

const ALL = 'ALL';

export function OvertimeControls() {
  const { data, setDivisionOvertime, offerOvertime } = useStore();
  const [division, setDivision] = useState(ALL);
  const override = division === ALL ? undefined : data.divisionOvertime[division];
  const [rate, setRate] = useState<number | null>(null); // null = not being edited
  const [picked, setPicked] = useState<string[]>([]);
  const [day, setDay] = useState(data.today);
  const [hours, setHours] = useState(2);
  const [note, setNote] = useState('Extra roasting for the weekend market.');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const people = data.employees.filter((e) => division === ALL || e.division === division);
  const name = (id: string) => data.employees.find((e) => e.id === id)!.name;
  const shownRate = rate ?? override ?? data.config.overtimeRatePerHour;

  const act = (fn: () => void, message: string) => {
    setError(null);
    try {
      fn();
      setDone(message);
      setRate(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const pickDivision = (next: string) => {
    setDivision(next);
    setRate(null);
    setPicked([]);
    setDone(null);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    act(() => {
      offerOvertime(picked, { date: day, hours, note });
      setPicked([]);
    }, `Offer sent to ${picked.length} employee${picked.length === 1 ? '' : 's'} by WhatsApp (simulated).`);
  };

  return (
    <Panel className="mt-8">
      <div id="overtime" className="scroll-mt-40" />
      <h2>Overtime rules and offers</h2>
      <p className="mt-2 max-w-2xl text-sm text-text-70">
        The overtime rate in Global rules is the default for everyone. Pick a division to give it its own rate (an override) or to offer overtime to its people.
        Employees accept or decline, then mark it done after working it. Only completed overtime is paid.
      </p>

      <div className="field mt-5 max-w-sm">
        <label htmlFor="division">Position / division</label>
        <select id="division" value={division} onChange={(e) => pickDivision(e.target.value)}>
          <option value={ALL}>All divisions (global default)</option>
          {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="rounded-[var(--radius)] bg-gray p-5">
        {division === ALL ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            Overtime rate <span className="tabular font-semibold">{money(data.config.overtimeRatePerHour)}/hour</span> <Badge tone="muted">Default</Badge>
            <span className="text-muted">Change it under Global rules.</span>
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="field !mb-0">
              <label htmlFor="division-rate">Overtime rate for {division} (RM per hour)</label>
              <input id="division-rate" type="number" min={0} step={0.5} value={shownRate} onChange={(e) => setRate(Number(e.target.value))} className="tabular" />
            </div>
            <span className="mb-2">{override === undefined ? <Badge tone="muted">Default (global)</Badge> : <Badge tone="royal">Override</Badge>}</span>
            <span className="flex-1" />
            <button
              type="button" className="btn btn-primary" disabled={rate === null || rate === (override ?? data.config.overtimeRatePerHour)}
              onClick={() => act(() => setDivisionOvertime(division, rate), `${division} now uses ${money(rate ?? 0)}/hour.`)}
            >Save override</button>
            {override !== undefined && (
              <button type="button" className="btn btn-line" onClick={() => act(() => setDivisionOvertime(division, null), `${division} uses the global default again.`)}>Reset to default</button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className={TABLE}>
          <thead><tr>{['Division', 'People', 'Overtime rate', 'Source'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {DIVISIONS.map((d) => {
              const own = data.divisionOvertime[d];
              return (
                <tr key={d} className={d === division ? 'bg-royal/5' : ''}>
                  <td className={`${TD} font-semibold`}>{d}</td>
                  <td className={TD}>{data.employees.filter((e) => e.division === d).map((e) => `${e.name} (${e.position})`).join(', ')}</td>
                  <td className={`${TD} tabular`}>{money(own ?? data.config.overtimeRatePerHour)}/hour</td>
                  <td className={TD}>{own === undefined ? <Badge tone="muted">Default</Badge> : <Badge tone="royal">Override</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={submit} className="mt-8">
        <h3 className="text-[1.05rem] font-semibold">Offer overtime{division !== ALL && ` to ${division}`}</h3>
        <fieldset className="mt-3">
          <legend className="text-[0.85rem] font-semibold">Employees</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((e) => (
              <label key={e.id} className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-3 text-sm transition ${picked.includes(e.id) ? 'border-royal bg-royal/5' : 'border-line bg-white'}`}>
                <input type="checkbox" className="size-4 accent-[var(--royal)]" checked={picked.includes(e.id)} onChange={() => setPicked(picked.includes(e.id) ? picked.filter((x) => x !== e.id) : [...picked, e.id])} />
                <span>
                  <span className="font-semibold">{e.name}</span>
                  <span className="block text-xs text-muted">{e.position} · {e.division} · {money(overtimeRate(data, e))}/hour</span>
                </span>
              </label>
            ))}
          </div>
          {division !== ALL && people.length > 1 && (
            <button type="button" className="btn btn-ghost mt-2 !px-4 !py-2" onClick={() => setPicked(people.map((e) => e.id))}>Select everyone in {division}</button>
          )}
        </fieldset>
        <div className="mt-5 grid grid-cols-2 gap-x-3 sm:grid-cols-[1fr_1fr_2fr] sm:gap-x-6">
          <div className="field"><label htmlFor="day">Date</label><input id="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></div>
          <div className="field"><label htmlFor="hours">Hours</label><input id="hours" type="number" min={0.5} max={12} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} required /></div>
          <div className="field col-span-2 sm:col-span-1"><label htmlFor="note">Note</label><input id="note" value={note} onChange={(e) => setNote(e.target.value)} required /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={!picked.length}>Send offer</button>
          <span className="text-sm text-muted">
            {picked.length ? `Worth ${picked.map((id) => money(hours * overtimeRate(data, data.employees.find((e) => e.id === id)!))).join(' / ')} per person` : 'Choose who gets the offer'}
          </span>
        </div>
      </form>
      <ErrorNote message={error} />
      {done && !error && <p role="status" className="mt-3 text-sm font-medium text-success">{done}</p>}

      <h3 className="mt-8 text-[1.05rem] font-semibold">Offers sent</h3>
      <OvertimeTable rows={data.overtime.filter((o) => o.origin === 'HR')} name={name} />
    </Panel>
  );
}
