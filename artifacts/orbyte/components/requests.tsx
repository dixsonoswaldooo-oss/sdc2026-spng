'use client';
// Shared bits for leave and overtime lists (HR and employee screens).
import type { ReactNode } from 'react';
import { date } from '@/lib/format';
import type { LeaveRequest, Overtime } from '@/lib/types';
import { LABEL_BY, LEAVE_PAY, PLEASE_CHECK } from '@/lib/words';
import { Badge, Empty, TABLE, TD, TH } from './ui';

type Tone = 'warn' | 'success' | 'muted' | 'royal';

export const LEAVE_TYPE: Record<LeaveRequest['type'], string> = { LEAVE: 'Leave', PERMISSION: 'Permission', SICK: 'Sick', DAY_OFF: 'Day off' };
export const LEAVE_STATUS: Record<LeaveRequest['status'], [string, Tone]> = {
  PENDING: ['Waiting for HR', 'warn'], APPROVED: ['Approved', 'success'], REJECTED: ['Rejected', 'muted'],
  WITHDRAWN: ['Withdrawn', 'muted'], CANCELLED: ['Cancelled', 'muted'],
};
/** One main badge (paid or unpaid leave) and at most one small note: "Please check" when unsure, else who decided. */
export function LabelBadge({ leave }: { leave: LeaveRequest }) {
  const unsure = leave.labelSource !== 'HR' && leave.confidence < 0.6;
  const reading = leave.aiPending && leave.status === 'PENDING';
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge tone={leave.label === 'DIPOTONG' ? 'danger' : 'success'}>{LEAVE_PAY[leave.label]}</Badge>
      {unsure
        ? <Badge tone="warn">{PLEASE_CHECK}</Badge>
        : <span className="text-xs text-muted">{reading ? 'AI is reading…' : LABEL_BY[leave.labelSource]}</span>}
    </span>
  );
}

export const OT_STATUS: Record<Overtime['status'], [string, Tone]> = {
  OFFERED: ['Offered', 'warn'], ACCEPTED: ['Accepted', 'royal'], DECLINED: ['Declined', 'muted'], REQUESTED: ['Requested', 'warn'],
  APPROVED: ['Approved', 'royal'], REJECTED: ['Rejected', 'muted'], COMPLETED: ['Done · paid', 'success'],
  WITHDRAWN: ['Withdrawn', 'muted'], CANCELLED: ['Cancelled', 'muted'],
};

/** Status badge plus the extra states shown on both sides: cancellation asked, edited while pending. */
export function StatusBadges({ item, words }: { item: LeaveRequest | Overtime; words: [string, Tone] }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge tone={words[1]}>{words[0]}</Badge>
      {item.cancelRequestedAt && <Badge tone="warn">Cancellation requested</Badge>}
      {item.editedAt && (item.status === 'PENDING' || item.status === 'REQUESTED') && <Badge tone="navy">Edited</Badge>}
    </span>
  );
}

export function OvertimeTable({ rows, name, action }: { rows: Overtime[]; name: (id: string) => string; action?: (o: Overtime) => ReactNode }) {
  if (!rows.length) return <div className="mt-4"><Empty>Nothing here yet.</Empty></div>;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className={TABLE}>
        <thead><tr>{['Employee', 'Date', 'Hours', 'Note', 'Status', ...(action ? [''] : [])].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td className={TD}>{name(o.employeeId)}</td>
              <td className={TD}>{date(o.date)}</td>
              <td className={TD}>{o.hours} h</td>
              <td className={`${TD} max-w-xs`}>{o.note}</td>
              <td className={TD}><StatusBadges item={o} words={OT_STATUS[o.status]} /></td>
              {action && <td className={TD}>{action(o)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A button that may be unavailable; the reason is shown as text under it (not only on hover). */
export function GuardedButton({ label, blocked, onClick, primary = false }: { label: string; blocked: string | null; onClick: () => void; primary?: boolean }) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-ghost'} !px-4 !py-2`} disabled={!!blocked} onClick={onClick}>{label}</button>
      {blocked && <span className="max-w-[16rem] text-xs text-muted">{blocked}</span>}
    </span>
  );
}
