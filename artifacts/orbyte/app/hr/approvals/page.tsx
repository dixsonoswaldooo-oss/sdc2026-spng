'use client';
import { useState } from 'react';
import { Badge, Empty, ErrorNote, PageHead, Panel, TABLE, TD, TH } from '@/components/ui';
import { date, dateTime, money } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { LeaveLabel } from '@/lib/types';
import { LabelBadge, LEAVE_TYPE, OvertimeTable, STATUS_TONE } from '@/components/requests';

export default function Approvals() {
  const { data, decideLeave, setLeaveLabel, moveOvertime } = useStore();
  const [tab, setTab] = useState<'overtime' | 'leave'>('leave');
  const [error, setError] = useState<string | null>(null);
  const name = (id: string) => data.employees.find((e) => e.id === id)!.name;
  const act = (fn: () => void) => {
    setError(null);
    try { fn(); } catch (e) { setError((e as Error).message); }
  };
  const pendingLeave = data.leaves.filter((l) => l.status === 'PENDING');
  const decidedLeave = data.leaves.filter((l) => l.status !== 'PENDING');
  const pendingOt = data.overtime.filter((o) => o.status === 'REQUESTED');
  const decidedOt = data.overtime.filter((o) => o.origin === 'EMPLOYEE' && o.status !== 'REQUESTED');

  const tabButton = (id: typeof tab, label: string, count: number) => (
    <button
      type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      className={`btn !px-5 ${tab === id ? 'btn-primary' : 'btn-ghost'}`}
    >
      {label} {count > 0 && <span className={`rounded-full px-1.5 text-xs ${tab === id ? 'bg-white/20' : 'bg-royal/10 text-royal'}`}>{count}</span>}
    </button>
  );

  return (
    <>
      <PageHead eyebrow="Approvals" title="Requests waiting for HR">
        Leave reasons are read by AI (SEA-LION) first. You decide: approve or reject, and change the label if the AI got it wrong.
      </PageHead>
      <div role="tablist" className="mb-6 flex gap-2">{tabButton('leave', 'Leave', pendingLeave.length)}{tabButton('overtime', 'Overtime', pendingOt.length)}</div>
      <ErrorNote message={error} />

      {tab === 'leave' ? (
        <>
          <Panel>
            <h2>Waiting ({pendingLeave.length})</h2>
            {pendingLeave.length === 0 ? <div className="mt-4"><Empty>No leave requests waiting.</Empty></div> : (
              <ul className="mt-4 space-y-4">
                {pendingLeave.map((l) => (
                  <li key={l.id} className="rounded-[var(--radius)] bg-gray p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{name(l.employeeId)} · {LEAVE_TYPE[l.type]}</p>
                        <p className="text-sm text-muted">{date(l.startDate)}{l.endDate !== l.startDate && ` – ${date(l.endDate)}`} · sent {dateTime(l.createdAt)}</p>
                      </div>
                      <LabelBadge leave={l} />
                    </div>
                    <p className="mt-3 text-sm"><span className="text-muted">Reason: </span>“{l.reason}”</p>
                    <p className="mt-2 text-sm text-text-70">
                      <span className="text-muted">{l.labelSource === 'HR' ? 'Note: ' : 'AI says: '}</span>{l.labelReason}
                      {l.labelSource !== 'HR' && <span className="text-muted"> · confidence {Math.round(l.confidence * 100)}%</span>}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Label</span>
                        <select
                          value={l.label}
                          onChange={(e) => act(() => setLeaveLabel(l.id, e.target.value as LeaveLabel))}
                          className="rounded-[var(--radius-sm)] border border-line bg-white px-3 py-2 text-sm"
                        >
                          <option value="DITOLERANSI">Tolerated (not deducted)</option>
                          <option value="DIPOTONG">Deducted (unpaid)</option>
                        </select>
                      </label>
                      <span className="flex-1" />
                      <button type="button" className="btn btn-ghost" onClick={() => act(() => decideLeave(l.id, false))}>Reject</button>
                      <button type="button" className="btn btn-primary" onClick={() => act(() => decideLeave(l.id, true))}>Approve</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel className="mt-8">
            <h2>Decided</h2>
            {decidedLeave.length === 0 ? <div className="mt-4"><Empty>Nothing decided yet.</Empty></div> : (
              <div className="mt-4 overflow-x-auto">
                <table className={TABLE}>
                  <thead><tr>{['Employee', 'Dates', 'Reason', 'Label', 'Status'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
                  <tbody>
                    {decidedLeave.map((l) => (
                      <tr key={l.id}>
                        <td className={TD}>{name(l.employeeId)}<span className="block text-xs text-muted">{LEAVE_TYPE[l.type]}</span></td>
                        <td className={TD}>{date(l.startDate)}{l.endDate !== l.startDate && ` – ${date(l.endDate)}`}</td>
                        <td className={`${TD} max-w-xs`}>“{l.reason}”</td>
                        <td className={TD}><LabelBadge leave={l} /></td>
                        <td className={TD}><Badge tone={STATUS_TONE[l.status]}>{l.status === 'APPROVED' ? 'Approved' : 'Rejected'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : (
        <>
          <Panel>
            <h2>Waiting ({pendingOt.length})</h2>
            {pendingOt.length === 0 ? <div className="mt-4"><Empty>No overtime requests waiting.</Empty></div> : (
              <ul className="mt-4 space-y-4">
                {pendingOt.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] bg-gray p-5">
                    <div>
                      <p className="font-semibold">{name(o.employeeId)} · {o.hours} h on {date(o.date)}</p>
                      <p className="mt-1 text-sm text-text-70">“{o.note}”</p>
                      <p className="mt-1 text-xs text-muted">Worth {money(o.hours * data.config.overtimeRatePerHour)} once marked done</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-ghost" onClick={() => act(() => moveOvertime(o.id, 'REJECTED'))}>Reject</button>
                      <button type="button" className="btn btn-primary" onClick={() => act(() => moveOvertime(o.id, 'APPROVED'))}>Approve</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel className="mt-8">
            <h2>Decided</h2>
            <OvertimeTable rows={decidedOt} name={name} />
          </Panel>
        </>
      )}
    </>
  );
}
