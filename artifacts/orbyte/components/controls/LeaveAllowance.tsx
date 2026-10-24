'use client';
// Annual leave allowance per employee. Only approved "Leave"-type working days count as used.
import { useState } from 'react';
import { Notice, Panel, TABLE, TD, TH } from '@/components/ui';
import { leaveUsed } from '@/lib/engine';
import { DEMO_MONTH } from '@/lib/seed';
import { useStore } from '@/lib/store';

export function LeaveAllowance() {
  const { data, updateLeaveAllowance } = useStore();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const year = DEMO_MONTH.slice(0, 4);

  const save = (id: string, name: string, days: number) => {
    setError(null);
    try {
      updateLeaveAllowance(id, days);
      setDraft(({ [id]: _, ...rest }) => rest);
      setSaved(`${name}'s allowance saved.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Panel className="mt-6">
      <h2>Leave allowance per employee</h2>
      <p className="mt-2 max-w-2xl text-sm text-text-70">
        Annual leave for {year}. Approved requests of type &ldquo;Leave&rdquo; use it up (working days only); sick, permission and day-off requests don&apos;t.
        Going over the allowance only shows a warning: pay still follows the paid or unpaid decision on each leave.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className={TABLE}>
          <thead><tr>{['Employee', 'Position / division', 'Annual allowance (days)', 'Used', 'Remaining', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {data.employees.map((e) => {
              const used = leaveUsed(data, e.id);
              const text = draft[e.id] ?? String(e.annualLeaveDays);
              const value = Number(text);
              const invalid = text.trim() === '' || !Number.isInteger(value) || value < 0;
              const dirty = !invalid && value !== e.annualLeaveDays;
              const remaining = e.annualLeaveDays - used;
              const hintId = `allowance-hint-${e.id}`;
              return (
                <tr key={e.id}>
                  <td className={`${TD} font-semibold`}>{e.name}</td>
                  <td className={TD}>{e.position}<span className="block text-xs text-muted">{e.division}</span></td>
                  <td className={TD}>
                    <input
                      aria-label={`Annual leave allowance for ${e.name}`} aria-invalid={invalid} aria-describedby={hintId}
                      type="number" min={0} step={1} value={text}
                      onChange={(ev) => setDraft({ ...draft, [e.id]: ev.target.value })}
                      className={`tabular w-24 rounded-[var(--radius-sm)] border px-3 py-2 ${invalid ? 'border-danger' : 'border-line'}`}
                    />
                    <span id={hintId} className="mt-1 block max-w-[14rem] text-xs">
                      {invalid ? <span className="text-danger">Enter a whole number, 0 or more.</span>
                        : value < used ? <span className="text-warn">Lower than the {used} day{used === 1 ? '' : 's'} already used.</span> : null}
                    </span>
                  </td>
                  <td className={`${TD} tabular`}>{used}</td>
                  <td className={`${TD} tabular font-semibold ${remaining < 0 ? 'text-danger' : ''}`}>{remaining}{remaining < 0 && <span className="block text-xs font-normal">over the allowance</span>}</td>
                  <td className={TD}>
                    <button type="button" className="btn btn-ghost !px-4 !py-2" disabled={!dirty} onClick={() => save(e.id, e.name, value)}>Save</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Notice error={error} success={saved} />
    </Panel>
  );
}
