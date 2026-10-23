'use client';
// Salary & leave controls: global rules, overtime per division, pay per employee (live preview) and leave allowance.
import { useState } from 'react';
import { LeaveAllowance } from '@/components/controls/LeaveAllowance';
import { OvertimeControls } from '@/components/controls/OvertimeControls';
import { Badge, Cell, ErrorNote, Money, PageHead, Panel, TABLE, TD, TH } from '@/components/ui';
import { attendanceOf, isPaid, payrollFor } from '@/lib/engine';
import { monthName } from '@/lib/format';
import { computePayroll } from '@/lib/payroll';
import { DEMO_MONTH } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { PayrollConfig } from '@/lib/types';

const FIELDS: [keyof PayrollConfig, string, string, number][] = [
  ['overtimeRatePerHour', 'Overtime rate', 'RM per hour · default for every division', 0.5],
  ['lateToleranceMinutes', 'Late tolerance', 'minutes', 1],
  ['lateRatePerMinute', 'Late deduction rate', 'RM per minute beyond tolerance', 0.05],
  ['absentDeductionPct', 'Absence deduction', '% of daily wage per day', 5],
  ['leaveDeductionPct', 'Unpaid leave deduction', '% of daily wage per day', 5],
];

export default function SalaryControls() {
  const { data, updateConfig, updateEmployeePay } = useStore();
  const [config, setConfig] = useState(data.config);
  const [pay, setPay] = useState(() => Object.fromEntries(data.employees.map((e) => [e.id, { base: e.baseSalary, bonus: e.bonus }])));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const locked = isPaid(data, DEMO_MONTH);
  const configChanged = FIELDS.some(([k]) => config[k] !== data.config[k]);

  const preview = (id: string) => {
    const e = data.employees.find((x) => x.id === id)!;
    return computePayroll({
      employee: { ...e, baseSalary: pay[id].base, bonus: pay[id].bonus }, month: DEMO_MONTH, today: data.today,
      config: { ...config, overtimeRatePerHour: data.divisionOvertime[e.division] ?? config.overtimeRatePerHour },
      attendance: attendanceOf(data, id), leaves: data.leaves.filter((l) => l.employeeId === id),
      overtime: data.overtime.filter((o) => o.employeeId === id),
    });
  };
  const act = (fn: () => void, message: string) => {
    setError(null);
    try {
      fn();
      setSaved(message);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <PageHead eyebrow="Salary & leave controls" title="Pay, overtime and leave rules">
        Change a number and the preview updates at once. Saving recalculates everyone, sends WhatsApp updates for changed deductions and records it in the activity log.
      </PageHead>
      {locked && <p className="mb-6 rounded-[var(--radius-sm)] bg-gray px-4 py-3 text-sm"><Badge tone="success">{monthName(DEMO_MONTH)} is paid</Badge> <span className="ml-2 text-muted">Its amounts are frozen; changes here apply to the next payroll.</span></p>}

      <Panel>
        <h2>Global rules</h2>
        <div className="mt-5 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-5">
          {FIELDS.map(([key, label, unit, step]) => (
            <div key={key} className="field">
              <label htmlFor={key}>{label}</label>
              <input id={key} type="number" min={0} step={step} value={config[key]} onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })} className="tabular" />
              <span className="mt-1 block text-xs text-muted">{unit}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={!configChanged} onClick={() => act(() => updateConfig(config), 'Rules saved. Pay recalculated.')}>Save rules</button>
          {configChanged && <button type="button" className="btn btn-line" onClick={() => setConfig(data.config)}>Undo</button>}
          {configChanged && <span className="text-sm text-warn">Preview below uses these unsaved rules.</span>}
        </div>
        <ErrorNote message={error} />
        {saved && !error && <p role="status" className="mt-3 text-sm font-medium text-success">{saved}</p>}
      </Panel>

      <OvertimeControls />

      <Panel className="mt-8">
        <h2>Pay per employee</h2>
        <div className="mt-4 overflow-x-auto">
          <table className={TABLE}>
            <thead><tr>{['Employee', 'Base salary (RM)', 'Bonus (RM)', 'Now', 'Preview', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {data.employees.map((e) => {
                const current = payrollFor(data, e.id, DEMO_MONTH).netPay;
                const next = preview(e.id).netPay;
                const dirty = pay[e.id].base !== e.baseSalary || pay[e.id].bonus !== e.bonus;
                return (
                  <tr key={e.id}>
                    <td className={TD}><span className="font-semibold">{e.name}</span><span className="block text-xs text-muted">{e.position}</span></td>
                    {(['base', 'bonus'] as const).map((f) => (
                      <td key={f} className={TD}>
                        <input
                          aria-label={`${f === 'base' ? 'Base salary' : 'Bonus'} for ${e.name}`}
                          type="number" min={0} step={50} value={pay[e.id][f]}
                          onChange={(ev) => setPay({ ...pay, [e.id]: { ...pay[e.id], [f]: Number(ev.target.value) } })}
                          className="tabular w-28 rounded-[var(--radius-sm)] border border-line px-3 py-2"
                        />
                      </td>
                    ))}
                    <td className={TD}><Money amount={current} /></td>
                    <td className={`${TD} font-semibold ${next > current ? 'text-success' : next < current ? 'text-danger' : ''}`}><Money amount={next} /></td>
                    <td className={TD}>
                      <button type="button" className="btn btn-ghost !px-4 !py-2" disabled={!dirty} onClick={() => act(() => updateEmployeePay(e.id, pay[e.id].base, pay[e.id].bonus), `${e.name}'s pay saved.`)}>Save</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <LeaveAllowance />
      <Cell className="mt-8"><p className="text-sm">Take-home pay = base + bonus + completed overtime − late, absence and unpaid-leave deductions. No tax, EPF, SOCSO or EIS in this demo.</p></Cell>
    </>
  );
}
