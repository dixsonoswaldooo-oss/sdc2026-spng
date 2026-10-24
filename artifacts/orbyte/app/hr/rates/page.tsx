'use client';
// Rates: every amount the pay is worked out with, in one place — overtime and deduction rules, then overtime per department.
import { useState } from 'react';
import { OvertimeRates } from '@/components/controls/OvertimeRates';
import { Badge, Cell, Notice, PageHead, Panel } from '@/components/ui';
import { isPaid } from '@/lib/engine';
import { monthName } from '@/lib/format';
import { DEMO_MONTH } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { PayrollConfig } from '@/lib/types';

type Field = [keyof PayrollConfig, string, string, number];
const GROUPS: [string, Field[]][] = [
  ['Overtime', [['overtimeRatePerHour', 'Overtime rate', 'RM per hour, for every department without its own rate', 0.5]]],
  ['Late arrival', [
    ['lateToleranceMinutes', 'Late tolerance', 'minutes late that are not cut', 1],
    ['lateRatePerMinute', 'Late deduction', 'RM per minute beyond the tolerance', 0.05],
  ]],
  ['Absence and unpaid leave', [
    ['absentDeductionPct', 'Absence deduction', '% of the daily wage per day absent', 5],
    ['leaveDeductionPct', 'Unpaid leave deduction', '% of the daily wage per unpaid leave day', 5],
  ]],
];
const FIELDS = GROUPS.flatMap(([, fields]) => fields);

export default function Rates() {
  const { data, updateConfig } = useStore();
  const [config, setConfig] = useState(data.config);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const changed = FIELDS.some(([k]) => config[k] !== data.config[k]);

  const save = () => {
    setError(null);
    try {
      updateConfig(config);
      setSaved('Rates saved. Everyone\'s pay is recalculated.');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <PageHead eyebrow="Rates" title="Rates and deductions">
        Set the amounts pay is worked out with. Saving recalculates everyone and tells them by WhatsApp if a cut changes.
      </PageHead>
      {isPaid(data, DEMO_MONTH) && <p className="mb-6 rounded-[var(--radius-sm)] bg-gray px-4 py-3 text-sm"><Badge tone="success">{monthName(DEMO_MONTH)} is paid</Badge> <span className="ml-2 text-muted">Its amounts are frozen; changes here apply to the next payroll.</span></p>}

      <Panel>
        <h2>Overtime and deduction rates</h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-3">
          {GROUPS.map(([title, fields]) => (
            <fieldset key={title} className="rounded-[var(--radius)] bg-gray p-5">
              <legend className="sr-only">{title}</legend>
              <h3 className="text-[1rem]">{title}</h3>
              <div className="mt-3">
                {fields.map(([key, label, unit, step]) => (
                  <div key={key} className="field">
                    <label htmlFor={key}>{label}</label>
                    <input id={key} type="number" min={0} step={step} value={config[key]} onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })} className="tabular" />
                    <span className="mt-1 block text-xs text-muted">{unit}</span>
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={!changed} onClick={save}>Save rates</button>
          {changed && <button type="button" className="btn btn-ghost" onClick={() => setConfig(data.config)}>Undo</button>}
          {changed && <span className="text-sm text-warn">Not saved yet.</span>}
        </div>
        <Notice error={error} success={saved} />
      </Panel>

      <OvertimeRates />

      <Cell className="mt-8"><p className="text-sm">Take-home pay = base + bonus + completed overtime − late, absence and unpaid-leave deductions. No tax, EPF, SOCSO or EIS in this demo.</p></Cell>
    </>
  );
}
