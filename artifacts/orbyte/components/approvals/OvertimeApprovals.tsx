'use client';
// HR's overtime queue: waiting requests, cancellation requests, and decided ones that can go back to pending.
import { GuardedButton, OT_STATUS, OvertimeTable, StatusBadges } from '@/components/requests';
import { Empty, Panel, type Confirm } from '@/components/ui';
import { overtimeRate, paidReason } from '@/lib/engine';
import { date, dateTime, money } from '@/lib/format';
import { useStore } from '@/lib/store';

export function OvertimeApprovals({ act, ask }: { act: (fn: () => void) => void; ask: (c: Confirm) => void }) {
  const { data, moveOvertime, revertOvertime, decideOvertimeCancellation } = useStore();
  const person = (id: string) => data.employees.find((e) => e.id === id)!;
  const name = (id: string) => person(id).name;
  const pending = data.overtime.filter((o) => o.status === 'REQUESTED');
  const cancellations = data.overtime.filter((o) => o.cancelRequestedAt);
  const decided = data.overtime.filter((o) => o.origin === 'EMPLOYEE' && o.status !== 'REQUESTED');

  return (
    <>
      <Panel>
        <h2>Waiting ({pending.length})</h2>
        {pending.length === 0 ? <div className="mt-4"><Empty>No overtime requests waiting.</Empty></div> : (
          <ul className="mt-4 space-y-4">
            {pending.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] bg-gray p-5">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{name(o.employeeId)} · {o.hours} h on {date(o.date)} <StatusBadges item={o} words={OT_STATUS[o.status]} /></p>
                  <p className="mt-1 text-sm text-text-70">“{o.note}”</p>
                  <p className="mt-1 text-xs text-muted">Worth {money(o.hours * overtimeRate(data, person(o.employeeId)))} once marked done{o.editedAt && ` · edited ${dateTime(o.editedAt)}`}</p>
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

      {cancellations.length > 0 && (
        <Panel className="mt-8">
          <h2>Cancellation requests ({cancellations.length})</h2>
          <ul className="mt-4 space-y-4">
            {cancellations.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] bg-gray p-5">
                <div>
                  <p className="font-semibold">{name(o.employeeId)} wants to cancel {o.origin === 'HR' ? 'an accepted overtime offer' : 'approved overtime'}</p>
                  <p className="mt-1 text-sm text-muted">{o.hours} h on {date(o.date)} · asked {dateTime(o.cancelRequestedAt!)}</p>
                  <p className="mt-1 text-sm text-text-70">“{o.note}”</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => act(() => decideOvertimeCancellation(o.id, false))}>Keep it</button>
                  <button type="button" className="btn btn-primary" onClick={() => act(() => decideOvertimeCancellation(o.id, true))}>Approve cancellation</button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="mt-8">
        <h2>Decided and closed</h2>
        <OvertimeTable
          rows={decided}
          name={name}
          action={(o) => (o.status === 'APPROVED' || o.status === 'REJECTED' || o.status === 'COMPLETED') && (
            <GuardedButton
              label="Revert to pending"
              blocked={o.status === 'COMPLETED' ? 'Worked and marked done' : paidReason(data, [o.date])}
              onClick={() => ask({
                title: 'Revert to pending?',
                body: <>{name(o.employeeId)}&apos;s overtime ({o.hours} h on {date(o.date)}) goes back to the waiting list and its {OT_STATUS[o.status][0].toLowerCase()} decision is cleared. The revert is logged.</>,
                confirmLabel: 'Revert to pending',
                onConfirm: () => act(() => revertOvertime(o.id)),
              })}
            />
          )}
        />
      </Panel>
    </>
  );
}
