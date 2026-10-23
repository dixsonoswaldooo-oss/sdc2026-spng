'use client';
// HR's leave queue: waiting requests, cancellation requests, and decided ones that can go back to pending.
import { GuardedButton, LabelBadge, LEAVE_STATUS, LEAVE_TYPE, StatusBadges } from '@/components/requests';
import { Empty, Panel, TABLE, TD, TH, type Confirm } from '@/components/ui';
import { LABEL_WORDS, paidReason } from '@/lib/engine';
import { date, dateTime } from '@/lib/format';
import { datesBetween } from '@/lib/payroll';
import { useStore } from '@/lib/store';
import type { LeaveLabel, LeaveRequest } from '@/lib/types';

const dates = (l: LeaveRequest) => `${date(l.startDate)}${l.endDate !== l.startDate ? ` – ${date(l.endDate)}` : ''}`;

export function LeaveApprovals({ act, ask }: { act: (fn: () => void) => void; ask: (c: Confirm) => void }) {
  const { data, decideLeave, setLeaveLabel, revertLeave, decideLeaveCancellation } = useStore();
  const name = (id: string) => data.employees.find((e) => e.id === id)!.name;
  const pending = data.leaves.filter((l) => l.status === 'PENDING');
  const cancellations = data.leaves.filter((l) => l.status === 'APPROVED' && l.cancelRequestedAt);
  const decided = data.leaves.filter((l) => l.status !== 'PENDING');

  return (
    <>
      <Panel>
        <h2>Waiting ({pending.length})</h2>
        {pending.length === 0 ? <div className="mt-4"><Empty>No leave requests waiting.</Empty></div> : (
          <ul className="mt-4 space-y-4">
            {pending.map((l) => (
              <li key={l.id} className="rounded-[var(--radius)] bg-gray p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{name(l.employeeId)} · {LEAVE_TYPE[l.type]}</p>
                    <p className="text-sm text-muted">{dates(l)} · sent {dateTime(l.createdAt)}{l.editedAt && ` · edited ${dateTime(l.editedAt)}`}</p>
                  </div>
                  <span className="flex flex-wrap gap-1"><StatusBadges item={l} words={LEAVE_STATUS[l.status]} /><LabelBadge leave={l} /></span>
                </div>
                <p className="mt-3 text-sm"><span className="text-muted">Reason: </span>“{l.reason}”</p>
                <p className="mt-2 text-sm text-text-70">
                  <span className="text-muted">{l.labelSource === 'HR' ? 'Note: ' : l.aiPending ? 'Keyword rules (AI still reading): ' : 'AI says: '}</span>{l.labelReason}
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

      {cancellations.length > 0 && (
        <Panel className="mt-8">
          <h2>Cancellation requests ({cancellations.length})</h2>
          <ul className="mt-4 space-y-4">
            {cancellations.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] bg-gray p-5">
                <div>
                  <p className="font-semibold">{name(l.employeeId)} wants to cancel approved {LEAVE_TYPE[l.type].toLowerCase()}</p>
                  <p className="mt-1 text-sm text-muted">{dates(l)} · label {LABEL_WORDS[l.label]} · asked {dateTime(l.cancelRequestedAt!)}</p>
                  <p className="mt-1 text-sm text-text-70">“{l.reason}”</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => act(() => decideLeaveCancellation(l.id, false))}>Keep approval</button>
                  <button type="button" className="btn btn-primary" onClick={() => act(() => decideLeaveCancellation(l.id, true))}>Approve cancellation</button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="mt-8">
        <h2>Decided and closed</h2>
        {decided.length === 0 ? <div className="mt-4"><Empty>Nothing decided yet.</Empty></div> : (
          <div className="mt-4 overflow-x-auto">
            <table className={TABLE}>
              <thead><tr>{['Employee', 'Dates', 'Reason', 'Label', 'Status', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {decided.map((l) => (
                  <tr key={l.id}>
                    <td className={TD}>{name(l.employeeId)}<span className="block text-xs text-muted">{LEAVE_TYPE[l.type]}</span></td>
                    <td className={TD}>{dates(l)}</td>
                    <td className={`${TD} max-w-xs`}>“{l.reason}”</td>
                    <td className={TD}><LabelBadge leave={l} /></td>
                    <td className={TD}>
                      <StatusBadges item={l} words={LEAVE_STATUS[l.status]} />
                      {l.decidedBy && <span className="mt-1 block text-xs text-muted">{l.decidedBy.replace(/^HR: /, '')} · {dateTime(l.decidedAt!)}</span>}
                    </td>
                    <td className={TD}>
                      {(l.status === 'APPROVED' || l.status === 'REJECTED') && (
                        <GuardedButton
                          label="Revert to pending"
                          blocked={paidReason(data, datesBetween(l.startDate, l.endDate))}
                          onClick={() => ask({
                            title: 'Revert to pending?',
                            body: <>{name(l.employeeId)}&apos;s {LEAVE_TYPE[l.type].toLowerCase()} ({dates(l)}) goes back to the waiting list and its {LEAVE_STATUS[l.status][0].toLowerCase()} decision is cleared. Pay is recalculated and the revert is logged.</>,
                            confirmLabel: 'Revert to pending',
                            onConfirm: () => act(() => revertLeave(l.id)),
                          })}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
