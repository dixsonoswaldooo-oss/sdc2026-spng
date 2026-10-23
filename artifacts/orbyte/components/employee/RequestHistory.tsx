'use client';
// The employee's own leave and overtime requests, with what they can still do to each one.
// Pending: edit or withdraw. Approved and not yet taken/worked: ask HR to cancel. Rejected: resubmit as a new request.
// Withdrawn and cancelled requests stay in the list. A disabled action shows why.
import { useState, type ReactNode } from 'react';
import { GuardedButton, LabelBadge, LEAVE_STATUS, LEAVE_TYPE, OT_STATUS, StatusBadges } from '@/components/requests';
import { ConfirmDialog, Empty, ErrorNote, TABLE, TD, TH, type Confirm } from '@/components/ui';
import { leaveCancelBlock, overtimeCancelBlock, paidReason } from '@/lib/engine';
import { date } from '@/lib/format';
import { datesBetween } from '@/lib/payroll';
import { useMe } from '@/lib/useMe';
import type { LeaveRequest, Overtime } from '@/lib/types';
import { EditRequest, type Editing } from './EditRequest';

export function RequestHistory({ onResubmitLeave, onResubmitOvertime }: { onResubmitLeave: (l: LeaveRequest) => void; onResubmitOvertime: (o: Overtime) => void }) {
  const { data, me, withdrawLeave, requestLeaveCancellation, withdrawOvertime, requestOvertimeCancellation } = useMe();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const myLeaves = data.leaves.filter((l) => l.employeeId === me.id);
  const myOt = data.overtime.filter((o) => o.employeeId === me.id && o.origin === 'EMPLOYEE');

  const act = (fn: () => void, message: string) => {
    setError(null);
    setDone(null);
    try {
      fn();
      setDone(message);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const ask = (title: string, body: ReactNode, confirmLabel: string, run: () => void, message: string) =>
    setConfirm({ title, body, confirmLabel, onConfirm: () => act(run, message) });

  const leaveActions = (l: LeaveRequest) => {
    const paid = paidReason(data, datesBetween(l.startDate, l.endDate));
    if (l.status === 'PENDING') return (
      <>
        <GuardedButton label="Edit" blocked={paid} onClick={() => setEditing({ kind: 'leave', item: l })} />
        <GuardedButton label="Withdraw" blocked={paid} onClick={() => ask('Withdraw this request?', 'It is removed from HR\'s list at once and stays in your history as "Withdrawn".', 'Withdraw', () => withdrawLeave(l.id), 'Request withdrawn.')} />
      </>
    );
    if (l.status === 'APPROVED') return l.cancelRequestedAt ? <span className="text-xs text-muted">Waiting for HR to decide the cancellation</span> : (
      <GuardedButton label="Request cancellation" blocked={leaveCancelBlock(data, l)} onClick={() => ask('Ask HR to cancel this leave?', 'Until HR decides, your leave stays approved. If HR agrees, your allowance and pay are restored.', 'Send to HR', () => requestLeaveCancellation(l.id), 'Cancellation sent to HR.')} />
    );
    if (l.status === 'REJECTED') return <GuardedButton label="Resubmit" blocked={null} onClick={() => onResubmitLeave(l)} />;
    return null;
  };

  const overtimeActions = (o: Overtime) => {
    const paid = paidReason(data, [o.date]);
    if (o.status === 'REQUESTED') return (
      <>
        <GuardedButton label="Edit" blocked={paid} onClick={() => setEditing({ kind: 'overtime', item: o })} />
        <GuardedButton label="Withdraw" blocked={paid} onClick={() => ask('Withdraw this request?', 'It is removed from HR\'s list at once and stays in your history as "Withdrawn".', 'Withdraw', () => withdrawOvertime(o.id), 'Request withdrawn.')} />
      </>
    );
    if (o.status === 'APPROVED') return o.cancelRequestedAt ? <span className="text-xs text-muted">Waiting for HR to decide the cancellation</span> : (
      <GuardedButton label="Request cancellation" blocked={overtimeCancelBlock(data, o)} onClick={() => ask('Ask HR to cancel this overtime?', 'Until HR decides, the overtime stays approved.', 'Send to HR', () => requestOvertimeCancellation(o.id), 'Cancellation sent to HR.')} />
    );
    if (o.status === 'REJECTED') return <GuardedButton label="Resubmit" blocked={null} onClick={() => onResubmitOvertime(o)} />;
    return null;
  };

  if (myLeaves.length + myOt.length === 0) return <div className="mt-4"><Empty>No requests yet.</Empty></div>;
  return (
    <>
      <ErrorNote message={error} />
      {done && !error && <p role="status" className="mt-3 text-sm font-medium text-success">{done}</p>}
      <div className="mt-4 overflow-x-auto">
        <table className={TABLE}>
          <thead><tr>{['Type', 'Dates', 'Reason', 'Label', 'Status', 'Actions'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {myLeaves.map((l) => (
              <tr key={l.id}>
                <td className={TD}>{LEAVE_TYPE[l.type]}</td>
                <td className={TD}>{date(l.startDate)}{l.endDate !== l.startDate && ` – ${date(l.endDate)}`}</td>
                <td className={`${TD} max-w-xs`}>“{l.reason}”<span className="mt-1 block text-xs text-muted">{l.aiPending && l.status === 'PENDING' ? 'The AI is reading your reason. HR will see its summary.' : l.labelReason}</span></td>
                <td className={TD}><LabelBadge leave={l} /></td>
                <td className={TD}><StatusBadges item={l} words={LEAVE_STATUS[l.status]} /></td>
                <td className={TD}><span className="flex flex-wrap gap-2">{leaveActions(l)}</span></td>
              </tr>
            ))}
            {myOt.map((o) => (
              <tr key={o.id}>
                <td className={TD}>Overtime</td>
                <td className={TD}>{date(o.date)} · {o.hours} h</td>
                <td className={`${TD} max-w-xs`}>“{o.note}”</td>
                <td className={TD}>—</td>
                <td className={TD}><StatusBadges item={o} words={OT_STATUS[o.status]} /></td>
                <td className={TD}><span className="flex flex-wrap gap-2">{overtimeActions(o)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
      <EditRequest editing={editing} onClose={() => setEditing(null)} onSaved={(m) => { setError(null); setDone(m); }} />
    </>
  );
}
