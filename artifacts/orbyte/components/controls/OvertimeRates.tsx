'use client';
// Overtime rate per department, on the Rates page. The global rate is the default; a department can have its own.
import { useState } from 'react';
import { Badge, Notice, Panel, TABLE, TD, TH } from '@/components/ui';
import { money } from '@/lib/format';
import { DIVISIONS } from '@/lib/seed';
import { useStore } from '@/lib/store';
import { RATE_KIND } from '@/lib/words';

export function OvertimeRates() {
  const { data, setDivisionOvertime } = useStore();
  const [division, setDivision] = useState(DIVISIONS[0]);
  const [rate, setRate] = useState<number | null>(null); // null = not being edited
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const own = data.divisionOvertime[division];
  const shownRate = rate ?? own ?? data.config.overtimeRatePerHour;

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

  return (
    <Panel className="mt-6">
      <h2>Overtime rate per department</h2>
      <p className="mt-2 max-w-2xl text-sm text-text-70">
        Every department uses the overtime rate above unless you give it its own. Only overtime marked done is paid.
      </p>
      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-[var(--radius)] bg-gray p-5">
        <div className="field !mb-0">
          <label htmlFor="division">Department</label>
          <select id="division" value={division} onChange={(e) => { setDivision(e.target.value); setRate(null); setDone(null); }}>
            {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="field !mb-0">
          <label htmlFor="division-rate">Overtime rate (RM per hour)</label>
          <input id="division-rate" type="number" min={0} step={0.5} value={shownRate} onChange={(e) => setRate(Number(e.target.value))} className="tabular" />
        </div>
        <span className="mb-2">{own === undefined ? <Badge tone="muted">{RATE_KIND.shared}</Badge> : <Badge tone="royal">{RATE_KIND.own}</Badge>}</span>
        <span className="flex-1" />
        <button
          type="button" className="btn btn-primary" disabled={rate === null || rate === (own ?? data.config.overtimeRatePerHour)}
          onClick={() => act(() => setDivisionOvertime(division, rate), `${division} now uses ${money(rate ?? 0)}/hour.`)}
        >Save own rate</button>
        {own !== undefined && (
          <button type="button" className="btn btn-ghost" onClick={() => act(() => setDivisionOvertime(division, null), `${division} uses the same rate as everyone again.`)}>Use the same rate as everyone</button>
        )}
      </div>
      <Notice error={error} success={done} />

      <div className="mt-4 overflow-x-auto">
        <table className={TABLE}>
          <thead><tr>{['Department', 'People', 'Overtime rate', 'Source'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {DIVISIONS.map((d) => {
              const rateOf = data.divisionOvertime[d];
              return (
                <tr key={d} className={d === division ? 'bg-royal/5' : ''}>
                  <td className={`${TD} font-semibold`}>{d}</td>
                  <td className={TD}>{data.employees.filter((e) => e.division === d).map((e) => `${e.name} (${e.position})`).join(', ') || '—'}</td>
                  <td className={`${TD} tabular`}>{money(rateOf ?? data.config.overtimeRatePerHour)}/hour</td>
                  <td className={TD}>{rateOf === undefined ? <Badge tone="muted">{RATE_KIND.shared}</Badge> : <Badge tone="royal">{RATE_KIND.own}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
